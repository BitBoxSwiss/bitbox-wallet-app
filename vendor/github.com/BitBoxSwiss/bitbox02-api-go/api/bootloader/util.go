// SPDX-License-Identifier: Apache-2.0

package bootloader

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
)

// HashFirmware returns the hash of `<firmware version><firmware>`, as computed by the bootloader to
// check the firmware signature.
func HashFirmware(firmwareVersion uint32, unsignedFirmware []byte) []byte {
	doubleHash := func(b []byte) []byte {
		first := sha256.Sum256(b)
		second := sha256.Sum256(first[:])
		return second[:]
	}
	firmwareVersionLE := make([]byte, 4)
	binary.LittleEndian.PutUint32(firmwareVersionLE, firmwareVersion)

	padded := bytes.Repeat([]byte{0xFF}, maxFirmwareSize)
	copy(padded, unsignedFirmware)
	return doubleHash(append(firmwareVersionLE, padded...))
}

// ParseSignedFirmware parses a signed firmware file and returns (sigdata, firmware). Errors if the
// format is invalid, or the firmware magic is not recognized.
func ParseSignedFirmware(firmware []byte) (common.Product, []byte, []byte, error) {
	if len(firmware) <= magicLen+sigDataLen {
		return "", nil, nil, errp.New("firmware too small")
	}
	magic, firmware := firmware[:magicLen], firmware[magicLen:]
	sigData, firmware := firmware[:sigDataLen], firmware[sigDataLen:]

	var product common.Product
	magicInt := binary.BigEndian.Uint32(magic)
	for p, productMagic := range sigDataMagic {
		if magicInt == productMagic {
			product = p
			break
		}
	}
	if product == "" {
		return "", nil, nil, errp.Newf("unrecognized magic")
	}

	return product, sigData, firmware, nil
}
