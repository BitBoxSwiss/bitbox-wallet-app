package aes

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"io"

	"github.com/shiftdevices/godbb/util/errp"
)

// Pad pads the given bytes.
func Pad(src []byte) []byte {
	padding := aes.BlockSize - len(src)%aes.BlockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(src, padtext...)
}

// Unpad unpads the given bytes.
func Unpad(src []byte) ([]byte, error) {
	length := len(src)
	unpadding := int(src[length-1])

	if unpadding > length {
		return nil, errp.New("unpad error. This could happen when incorrect encryption key is used")
	}

	return src[:(length - unpadding)], nil
}

// Encrypt encrypts the given text with the given key.
func Encrypt(key []byte, text []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", errp.WithStack(err)
	}

	msg := Pad(text)
	ciphertext := make([]byte, aes.BlockSize+len(msg))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", errp.WithStack(err)
	}
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext[aes.BlockSize:], msg)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts the given text with the given key.
func Decrypt(key []byte, text string) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	decodedMsg, err := base64.StdEncoding.DecodeString(text)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	if (len(decodedMsg) % aes.BlockSize) != 0 {
		return nil, errp.New("blocksize must be multiple of decoded message length")
	}

	iv := decodedMsg[:aes.BlockSize]
	msg := decodedMsg[aes.BlockSize:]
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(msg, msg)
	return Unpad(msg)
}
