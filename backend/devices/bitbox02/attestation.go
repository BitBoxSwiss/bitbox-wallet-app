package bitbox02

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/hex"
	"math/big"

	"github.com/btcsuite/btcd/btcec"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/random"
)

// attestationPubkeys is a map of attestation pubkey identifier to attestation pubkey.
// the pubkey is an uncompressed SECP256k1 pubkey.
var attestationPubkeys = map[string]string{
	"f36581299c784acfe26d735c1f937f7e397ee471a02983906a29660f3eee2004": "04074ff1273b36c24e80fe3d59e0e897a81732d3f8e9cd07e17e9fc06319cd16b25cf74255674477b3ac9cbac2d12f0dc27a662681fcbc12955b0bccdcbbdcfd01",
}

// performAttestation sends a random challenge and verifies that the response can be verified with
// Shift's root attestation pubkeys. Returns true if the verification is successful.
func (device *Device) performAttestation() (bool, error) {
	challenge := random.BytesOrPanic(32)
	response, err := device.queryRaw(append([]byte(opAttestation), challenge...))
	if err != nil {
		return false, err
	}
	if string(response[:1]) != responseSuccess {
		return false, nil
	}
	response = response[1:]
	var bootloaderHash, devicePubkeyBytes, certificate, rootPubkeyIdentifier, challengeSignature []byte
	bootloaderHash, response = response[:32], response[32:]
	devicePubkeyBytes, response = response[:64], response[64:]
	certificate, response = response[:64], response[64:]
	rootPubkeyIdentifier, response = response[:32], response[32:]
	challengeSignature = response[:64]

	rootPubkeyHex, ok := attestationPubkeys[hex.EncodeToString(rootPubkeyIdentifier)]
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
		X:     new(big.Int).SetBytes(devicePubkeyBytes[:32]),
		Y:     new(big.Int).SetBytes(devicePubkeyBytes[32:]),
	}

	verify := func(pubkey *ecdsa.PublicKey, message []byte, signature []byte) bool {
		sigR := new(big.Int).SetBytes(signature[:32])
		sigS := new(big.Int).SetBytes(signature[32:])
		sigHash := sha256.Sum256(message)
		return ecdsa.Verify(pubkey, sigHash[:], sigR, sigS)
	}

	// Verify certificate
	var certMsg bytes.Buffer
	certMsg.Write(bootloaderHash)
	certMsg.Write(devicePubkeyBytes)
	if !verify(rootPubkey.ToECDSA(), certMsg.Bytes(), certificate) {
		return false, nil
	}
	// Verify challenge
	if !verify(&devicePubkey, challenge, challengeSignature) {
		return false, nil
	}
	return true, nil
}

// Attestation returns the result of the automatic attestation check.
func (device *Device) Attestation() bool {
	return device.attestation
}
