#!/usr/bin/env python3
# Copyright 2025 Shift Crypto AG
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from flask import Flask, request, jsonify, abort
import uuid
import hashlib
import base64
from coincurve import PublicKey
from bech32 import bech32_encode, convertbits

app = Flask(__name__)

# In-memory store
requests_store = {}
REGTEST_NET = "regtest"

class AOPPProof:
    def __init__(self, version: int, address: str, signature: bytes):
        self.version = version
        self.address = address
        self.signature = signature

def sighash(msg: str) -> bytes:
    prefix = b"\x18Bitcoin Signed Message:\n"
    msg_bytes = msg.encode()
    return hashlib.sha256(hashlib.sha256(prefix + bytes([len(msg_bytes)]) + msg_bytes).digest()).digest()

def pubkey_to_p2wpkh_address(pubkey_bytes: bytes, network: str = "regtest") -> str:
    h160 = hashlib.new('ripemd160', hashlib.sha256(pubkey_bytes).digest()).digest()
    hrp = {"regtest": "bcrt"}.get(network, "bc")
    data = convertbits(h160, 8, 5)
    return bech32_encode(hrp, data)

@app.route("/cb", methods=["POST"])
def callback():
    request_id = request.args.get("id")
    if not request_id or request_id not in requests_store:
        abort(404, "unknown request ID")

    aopp_request = requests_store[request_id]
    if aopp_request["proof"] is not None:
        return jsonify({"error": "proof already submitted"}), 400

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "no JSON payload"}), 400

    try:
        addr = data.get("address") or data.get("Address")
        sig_b64 = data.get("signature") or data.get("Signature")
        version = int(data.get("version", 0))
        if not addr or not sig_b64:
            raise ValueError("missing required fields")
        proof_bytes = base64.b64decode(sig_b64)
        proof = AOPPProof(version=version, address=addr, signature=proof_bytes)
    except Exception as e:
        return jsonify({"error": f"invalid proof format: {e}"}), 400

    # extract msg from URI
    uri = aopp_request["uri"]
    msg_start = uri.find("msg=")
    msg_end = uri.find("&", msg_start)
    msg = uri[msg_start + 4:] if msg_end == -1 else uri[msg_start + 4:msg_end]

    sig_bytes = proof.signature
    if len(sig_bytes) == 64:
        compressed = True
        success = False
        for rec_id in range(4):
            candidate = bytes([27 + 4 + rec_id]) + sig_bytes
            try:
                pubkey = PublicKey.from_signature_and_message(candidate, sighash(msg), hasher=None)
                pubkey_bytes = pubkey.format(compressed=compressed)
                recovered_address = pubkey_to_p2wpkh_address(pubkey_bytes, REGTEST_NET)
                if recovered_address == proof.address:
                    proof.signature = candidate
                    success = True
                    break
            except Exception:
                continue
        if not success:
            return jsonify({"error": "cannot recover pubkey with any recID"}), 400

    aopp_request["proof"] = proof
    return "", 204

@app.route("/generate", methods=["POST"])
def generate():
    request_id = str(uuid.uuid4())
    msg = f"I confirm that I solely control this address. ID: {request_id}"
    callback = f"http://localhost:8888/cb?id={request_id}"
    asset = "rbtc"  # force asset
    uri = f"aopp:?v=0&msg={msg}&asset={asset}&format=any&callback={callback}"
    requests_store[request_id] = {"uri": uri, "proof": None}
    return jsonify({"id": request_id, "uri": uri})

if __name__ == "__main__":
    print("Listening on localhost:8888")
    app.run(host="localhost", port=8888)
