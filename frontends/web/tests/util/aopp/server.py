# SPDX-License-Identifier: Apache-2.0

import http.server
import socketserver
import json
import uuid
import hashlib
import base64
from urllib.parse import urlparse, parse_qs

from ecdsa import VerifyingKey, SECP256k1, util
from bech32 import bech32_encode, convertbits

# In-memory store
requests_store = {}
REGTEST_NET = "regtest"
PORT = 8888

class AOPPProof:
    def __init__(self, version: int, address: str, signature: bytes):
        self.version = version
        self.address = address
        self.signature = signature

def sighash(msg: str) -> bytes:
    prefix = b"\x18Bitcoin Signed Message:\n"
    msg_bytes = msg.encode()
    digest = hashlib.sha256(hashlib.sha256(prefix + bytes([len(msg_bytes)]) + msg_bytes).digest()).digest()
    return digest

def compress_pubkey(vk: VerifyingKey) -> bytes:
    """
    Manually compress a generic ECDSA public key.
    Format: <prefix> <x-coordinate>
    Prefix: 0x02 if Y is even, 0x03 if Y is odd.
    """
    # Get the point on the curve
    point = vk.pubkey.point

    # Get X as 32-byte integer
    x_bytes = point.x().to_bytes(32, 'big')

    # Determine prefix based on Y parity
    if point.y() & 1:
        prefix = b'\x03' # Odd
    else:
        prefix = b'\x02' # Even

    return prefix + x_bytes

def pubkey_to_p2wpkh_address(pubkey_bytes: bytes, network: str = "regtest") -> str:
    """
    Converts a compressed public key to a SegWit (P2WPKH) address.
    Format: bech32(HRP, [WitnessVersion(0)] + WitnessProgram)
    """
    sha256_digest = hashlib.sha256(pubkey_bytes).digest()
    h160 = hashlib.new('ripemd160', sha256_digest).digest()
    data = convertbits(h160, 8, 5)

    # Prepend Witness Version 0
    witness_program = [0] + data

    hrp = {"regtest": "bcrt"}.get(network, "bc")
    return bech32_encode(hrp, witness_program)

def verify_address_ownership(r_s_bytes: bytes, message_digest: bytes, expected_address: str, network: str) -> bool:
    """
    Recovers potential public keys from the signature (R, S) and checks
    if any of them derive to the expected address.
    """
    try:
        # ecdsa library can recover candidates directly from R+S.
        # It returns a list of VerifyingKey objects (usually 2).
        candidates = VerifyingKey.from_public_key_recovery_with_digest(
            r_s_bytes,
            message_digest,
            curve=SECP256k1,
            hashfunc=hashlib.sha256
        )

        for vk in candidates:
            # 1. Compress the key
            compressed_bytes = compress_pubkey(vk)

            # 2. Derive Address
            recovered_address = pubkey_to_p2wpkh_address(compressed_bytes, network)

            # 3. Check match
            if recovered_address == expected_address:
                return True

        return False
    except Exception:
        return False

# --- HTTP Request Handler ---

class AOPPRequestHandler(http.server.BaseHTTPRequestHandler):

    def _send_response(self, status_code, body=None):
        self.send_response(status_code)
        if body:
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(body).encode('utf-8'))
        else:
            self.end_headers()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query_params = parse_qs(parsed_path.query)

        if path == "/generate":
            self.handle_generate()
            return

        if path == "/cb":
            self.handle_callback(query_params)
            return

        self._send_response(404, {"error": "endpoint not found"})

    def handle_generate(self):
        request_id = str(uuid.uuid4())
        msg = f"I confirm that I solely control this address. ID: {request_id}"
        callback = f"http://localhost:{PORT}/cb?id={request_id}"
        asset = "rbtc"
        uri = f"aopp:?v=0&msg={msg}&asset={asset}&format=any&callback={callback}"

        requests_store[request_id] = {"uri": uri, "proof": None}
        self._send_response(200, {"id": request_id, "uri": uri})

    def handle_callback(self, query_params):
        # 1. Parse Query Params
        request_id_list = query_params.get("id")
        request_id = request_id_list[0] if request_id_list else None

        if not request_id or request_id not in requests_store:
            self._send_response(404, {"error": "unknown request ID"})
            return

        aopp_request = requests_store[request_id]
        if aopp_request["proof"] is not None:
            self._send_response(400, {"error": "proof already submitted"})
            return

        # 2. Parse JSON Body
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._send_response(400, {"error": "missing payload"})
            return

        post_data = self.rfile.read(content_length)
        try:
            data = json.loads(post_data)
        except json.JSONDecodeError:
            self._send_response(400, {"error": "invalid JSON"})
            return

        # 3. Process Proof Data
        try:
            addr = data.get("address") or data.get("Address")
            sig_b64 = data.get("signature") or data.get("Signature")
            version = int(data.get("version", 0))

            if not addr or not sig_b64:
                raise ValueError("missing required fields")

            proof_bytes = base64.b64decode(sig_b64)
            proof = AOPPProof(version=version, address=addr, signature=proof_bytes)
        except Exception as e:
            self._send_response(400, {"error": f"invalid proof format: {e}"})
            return

        # 4. Extract message from stored URI
        uri = aopp_request["uri"]
        msg_start = uri.find("msg=")
        msg_end = uri.find("&", msg_start)
        msg = uri[msg_start + 4:] if msg_end == -1 else uri[msg_start + 4:msg_end]

        sig_bytes = proof.signature
        message_digest = sighash(msg)

        # 5. Handle Signature Format (We need pure 64-byte R+S for ecdsa)
        r_s_bytes = b""
        if len(sig_bytes) == 65:
            r_s_bytes = sig_bytes[1:] # Strip Header
        elif len(sig_bytes) == 64:
            r_s_bytes = sig_bytes
        else:
            self._send_response(400, {"error": "invalid signature length"})
            return

        # 6. Verify
        # We don't need a loop here; ecdsa checks all candidates internally
        is_valid = verify_address_ownership(r_s_bytes, message_digest, proof.address, REGTEST_NET)

        if not is_valid:
            self._send_response(400, {"error": "cannot recover pubkey or address mismatch"})
            return

        # Success
        aopp_request["proof"] = proof
        self._send_response(204)

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("localhost", PORT), AOPPRequestHandler) as httpd:
        print(f"Listening on localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.shutdown()
