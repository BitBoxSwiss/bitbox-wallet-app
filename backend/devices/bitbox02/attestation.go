package bitbox02

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/hex"
	"math/big"

	"github.com/btcsuite/btcd/btcec"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"
)

// attestationPubkeys is a map of attestation pubkey identifier to attestation pubkey.
// the pubkey is an uncompressed SECP256k1 pubkey.
var attestationPubkeys = map[string]string{
	"f36581299c784acfe26d735c1f937f7e397ee471a02983906a29660f3eee2004": "04074ff1273b36c24e80fe3d59e0e897a81732d3f8e9cd07e17e9fc06319cd16b25cf74255674477b3ac9cbac2d12f0dc27a662681fcbc12955b0bccdcbbdcfd01",
}

// PerformAttestation sends a random challenge and verifies that the response can be verified with
// Shift's root attestation pubkeys. Returns true if the verification is successful.
func (device *Device) PerformAttestation() (bool, error) {
	challenge := random.BytesOrPanic(32)
	request := &messages.Request{
		Request: &messages.Request_PerformAttestation{
			PerformAttestation: &messages.PerformAttestationRequest{
				Challenge: challenge,
			},
		},
	}
	response, err := device.query(request)
	if err != nil {
		return false, err
	}
	attestationResponse, ok := response.Response.(*messages.Response_PerformAttestation)
	if !ok {
		return false, errp.New("unexpected response")
	}
	data := attestationResponse.PerformAttestation

	rootPubkeyHex, ok := attestationPubkeys[hex.EncodeToString(data.RootPubkeyIdentifier)]
	if !ok {
		return false, nil
	}
	rootPubkeyBytes, err := hex.DecodeString(rootPubkeyHex)
	if err != nil {
		panic(errp.WithStack(err))
	}
	rootPubkey, err := btcec.ParsePubKey(rootPubkeyBytes, btcec.S256())
	if err != nil {
		panic(errp.WithStack(err))
	}
	devicePubkey := ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(data.DevicePubkey[:32]),
		Y:     new(big.Int).SetBytes(data.DevicePubkey[32:]),
	}

	verify := func(pubkey *ecdsa.PublicKey, message []byte, signature []byte) bool {
		sigR := new(big.Int).SetBytes(signature[:32])
		sigS := new(big.Int).SetBytes(signature[32:])
		sigHash := sha256.Sum256(message)
		return ecdsa.Verify(pubkey, sigHash[:], sigR, sigS)
	}

	// Verify certificate
	var certMsg bytes.Buffer
	certMsg.Write(data.BootloaderHash)
	certMsg.Write(data.DevicePubkey)
	if !verify(rootPubkey.ToECDSA(), certMsg.Bytes(), data.Certificate) {
		return false, nil
	}
	// Verify challenge
	if !verify(&devicePubkey, challenge, data.ChallengeSignature) {
		return false, nil
	}
	return true, nil
}
