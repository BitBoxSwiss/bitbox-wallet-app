// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package crypto

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"io"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

// pad pads the given bytes to the AES block size.
func pad(src []byte) []byte {
	padding := aes.BlockSize - len(src)%aes.BlockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(src, padtext...)
}

// unpad unpads the given bytes from the AES block size.
func unpad(src []byte) ([]byte, error) {
	length := len(src)
	unpadding := int(src[length-1])

	if unpadding > length {
		return nil, errp.New("Unpad error, which can happen when incorrect encryption key is used.")
	}

	return src[:(length - unpadding)], nil
}

// Encrypt encrypts the given bytes with the given encryption key.
func Encrypt(bytes []byte, encryptionKey []byte) ([]byte, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	paddedBytes := pad(bytes)
	encryptedBytes := make([]byte, aes.BlockSize+len(paddedBytes))
	iv := encryptedBytes[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, errp.WithStack(err)
	}
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(encryptedBytes[aes.BlockSize:], paddedBytes)
	return encryptedBytes, nil
}

// EncryptThenMAC encrypts the given bytes with the given encryption key and appends an HMAC of the
// encrypted bytes with the given authentication key.
func EncryptThenMAC(bytes []byte, encryptionKey []byte, authenticationKey []byte) ([]byte, error) {
	encryptedBytes, err := Encrypt(bytes, encryptionKey)
	if err != nil {
		return nil, err
	}

	mac := hmac.New(sha256.New, authenticationKey)
	_, err = mac.Write(encryptedBytes)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return mac.Sum(encryptedBytes), nil
}

// Decrypt decrypts the given bytes with the given encryption key.
func Decrypt(bytes []byte, encryptionKey []byte) ([]byte, error) {
	if (len(bytes) % aes.BlockSize) != 0 {
		return nil, errp.New("The length of the encrypted bytes has to match the AES block size.")
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	iv := bytes[:aes.BlockSize]
	decryptedBytes := bytes[aes.BlockSize:]
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(decryptedBytes, decryptedBytes)
	return unpad(decryptedBytes)
}

// MACThenDecrypt authenticates the HMAC of the given bytes with the given authentication key and
// then decrypts the encrypted bytes with the given encryption key.
func MACThenDecrypt(bytes []byte, encryptionKey []byte, authenticationKey []byte) ([]byte, error) {
	mac := hmac.New(sha256.New, authenticationKey)
	encryptedBytes := bytes[:len(bytes)-sha256.Size]
	appendedHMAC := bytes[len(bytes)-sha256.Size:]
	_, err := mac.Write(encryptedBytes)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if !hmac.Equal(appendedHMAC, mac.Sum(nil)) {
		return nil, errp.New("The appended HMAC is wrong.")
	}

	return Decrypt(encryptedBytes, encryptionKey)
}
