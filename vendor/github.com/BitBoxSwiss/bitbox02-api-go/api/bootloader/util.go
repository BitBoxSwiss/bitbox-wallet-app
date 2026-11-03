// SPDX-License-Identifier: Apache-2.0

package bootloader

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
)

type firmwareHashScheme int

const (
	firmwareHashLegacy firmwareHashScheme = iota
	firmwareHashProduct
	firmwareHashVersioned
)

// HashFirmware returns the expected device-reported hash of a released firmware.
// The monotonic firmware version determines the hash format used to sign the release.
func HashFirmware(product common.Product, firmwareVersion uint32, unsignedFirmware []byte) ([]byte, error) {
	scheme := firmwareHashLegacy
	if firmwareVersion >= 57 {
		scheme = firmwareHashVersioned
	} else if firmwareVersion >= 51 {
		scheme = firmwareHashProduct
	}
	return hashFirmware(product, firmwareVersion, unsignedFirmware, scheme)
}

func hashFirmware(
	product common.Product,
	version uint32,
	firmware []byte,
	scheme firmwareHashScheme,
) ([]byte, error) {
	if len(firmware) > maxFirmwareSize {
		return nil, errp.New("firmware too big")
	}
	var productID uint16
	switch product {
	case common.ProductBitBox02Multi:
		productID = 1
	case common.ProductBitBox02BTCOnly:
		productID = 2
	case common.ProductBitBox02PlusMulti:
		productID = 3
	case common.ProductBitBox02PlusBTCOnly:
		productID = 4
	default:
		return nil, errp.New("unrecognized product")
	}

	preimage := make([]byte, 0, 1+2+4+maxFirmwareSize)
	if scheme == firmwareHashVersioned {
		preimage = append(preimage, 0x01)
	}
	if scheme != firmwareHashLegacy {
		preimage = binary.LittleEndian.AppendUint16(preimage, productID)
	}
	preimage = binary.LittleEndian.AppendUint32(preimage, version)
	preimage = append(preimage, firmware...)
	preimage = append(preimage, bytes.Repeat([]byte{0xFF}, maxFirmwareSize-len(firmware))...)
	hash := sha256.Sum256(preimage)
	if scheme == firmwareHashLegacy {
		hash = sha256.Sum256(hash[:])
	}
	return hash[:], nil
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
