package crypto

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"errors"

	"github.com/ethereum/go-ethereum/crypto"
	"golang.org/x/crypto/pbkdf2"
	"golang.org/x/text/unicode/norm"
)

const PairingTokenSalt = "Keycard Pairing Password Salt"

var ErrInvalidCardCryptogram = errors.New("invalid card cryptogram")

func GenerateECDHSharedSecret(priv *ecdsa.PrivateKey, pub *ecdsa.PublicKey) []byte {
	x, _ := crypto.S256().ScalarMult(pub.X, pub.Y, priv.D.Bytes())
	return x.Bytes()
}

func VerifyCryptogram(challenge []byte, pairingPass string, cardCryptogram []byte) ([]byte, error) {
	secretHash := pbkdf2.Key(norm.NFKD.Bytes([]byte(pairingPass)), norm.NFKD.Bytes([]byte(PairingTokenSalt)), 50000, 32, sha256.New)

	h := sha256.New()
	h.Write(secretHash[:])
	h.Write(challenge)
	expectedCryptogram := h.Sum(nil)

	if !bytes.Equal(expectedCryptogram, cardCryptogram) {
		return nil, ErrInvalidCardCryptogram
	}

	return secretHash, nil
}

func OneShotEncrypt(pubKeyData, secret, data []byte) ([]byte, error) {
	data = appendPadding(16, data)

	iv := make([]byte, 16)
	_, err := rand.Read(iv)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return nil, err
	}

	ciphertext := make([]byte, len(data))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, data)

	encrypted := append([]byte{byte(len(pubKeyData))}, pubKeyData...)
	encrypted = append(encrypted, iv...)
	encrypted = append(encrypted, ciphertext...)

	return encrypted, nil
}

func DeriveSessionKeys(secret, pairingKey, cardData []byte) ([]byte, []byte, []byte) {
	salt := cardData[:32]
	iv := cardData[32:]

	h := sha512.New()
	h.Write(secret)
	h.Write(pairingKey)
	h.Write(salt)
	data := h.Sum(nil)

	encKey := data[:32]
	macKey := data[32:]

	return encKey, macKey, iv
}

func EncryptData(data []byte, encKey []byte, iv []byte) ([]byte, error) {
	data = appendPadding(16, data)

	block, err := aes.NewCipher(encKey)
	if err != nil {
		return nil, err
	}

	ciphertext := make([]byte, len(data))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, data)

	return ciphertext, nil
}

func DecryptData(data []byte, encKey []byte, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(encKey)
	if err != nil {
		return nil, err
	}

	plaintext := make([]byte, len(data))
	mode := cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(plaintext, data)

	return removePadding(16, plaintext), nil
}

func CalculateMac(meta []byte, data []byte, macKey []byte) ([]byte, error) {
	data = appendPadding(16, data)

	block, err := aes.NewCipher(macKey)
	if err != nil {
		return nil, err
	}

	mode := cipher.NewCBCEncrypter(block, make([]byte, 16))
	mode.CryptBlocks(meta, meta)
	mode.CryptBlocks(data, data)

	mac := data[len(data)-32 : len(data)-16]

	return mac, nil
}

func appendPadding(blockSize int, data []byte) []byte {
	paddingSize := blockSize - (len(data) % blockSize)
	newData := make([]byte, len(data)+paddingSize)
	copy(newData, data)
	newData[len(data)] = 0x80

	return newData
}

func removePadding(blockSize int, data []byte) []byte {
	i := len(data) - 1
	for ; i > len(data)-blockSize; i-- {
		if data[i] == 0x80 {
			break
		}
	}

	return data[:i]
}
