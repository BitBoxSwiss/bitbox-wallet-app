package crypto

import (
	"testing"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/status-im/keycard-go/hexutils"
	"github.com/stretchr/testify/assert"
)

func TestECDH(t *testing.T) {
	pk1, err := crypto.GenerateKey()
	assert.NoError(t, err)
	pk2, err := crypto.GenerateKey()
	assert.NoError(t, err)

	sharedSecret1 := GenerateECDHSharedSecret(pk1, &pk2.PublicKey)
	sharedSecret2 := GenerateECDHSharedSecret(pk2, &pk1.PublicKey)

	assert.Equal(t, sharedSecret1, sharedSecret2)
}

func TestDeriveSessionKeys(t *testing.T) {
	secret := hexutils.HexToBytes("B410E816DA313545151807E25A830201FA389913A977066AB0C6DE0E8631E400")
	pairingKey := hexutils.HexToBytes("544FF0B9B0737E4BFC4ECDFCE09F522B837051BBE4FFCEC494FA420D8525670E")
	cardData := hexutils.HexToBytes("1D7C033E75E10EC578AB538F69F1B02538571BA3831441F1649E3F24B5B3E3E71D7BC2D6A3D02FC8CB2FBB3FD8711BB5")

	encKey, macKey, iv := DeriveSessionKeys(secret, pairingKey, cardData)

	expectedIV := "1D7BC2D6A3D02FC8CB2FBB3FD8711BB5"
	expectedEncKey := "4FF496554C01BAE0A52323E3481B448C99D43982118D95C6918FE0354D224B90"
	expectedMacKey := "185811013138EA1B4FFDBBFA7343EF2DBE3E54C2C231885E867F792448AC2FE5"

	assert.Equal(t, expectedIV, hexutils.BytesToHex(iv))
	assert.Equal(t, expectedEncKey, hexutils.BytesToHex(encKey))
	assert.Equal(t, expectedMacKey, hexutils.BytesToHex(macKey))
}

func TestEncryptData(t *testing.T) {
	data := hexutils.HexToBytes("A8A686D0E3290459BCB36088A8FD04A76BF13283BE4B1EAE2E1248EF609F94DC")
	encKey := hexutils.HexToBytes("44D689AB4B18206F7EEE5439FB9A71A8A617406BA5259728D1EBC2786D24896C")
	iv := hexutils.HexToBytes("9D3EF41EF1D221DD98A54AD5470F58F2")

	encryptedData, err := EncryptData(data, encKey, iv)
	assert.NoError(t, err)

	expected := "FFB41FED5F71A2B57A6AE62D5D5ECD1C12616F6464637DD0A7A930920ACBA55867A7E12CC4F06B089AF34FF4ED4BAB08"
	assert.Equal(t, expected, hexutils.BytesToHex(encryptedData))
}

func TestDecryptData(t *testing.T) {
	encData := hexutils.HexToBytes("73B58B66372E3446E14A9F54BA59666DB432E9DD87D24F9B0525180EE52DA2106E0C70EED7CD42B5B313E4443D6AC90D")
	encKey := hexutils.HexToBytes("D93D8E6164196D5C5B5F84F10E4B90D98F8D282ED145513ED666AA55C9871E79")
	iv := hexutils.HexToBytes("F959B1220333046D3C47D61B1E1B891B")

	data, err := DecryptData(encData, encKey, iv)
	assert.NoError(t, err)

	expected := "2E21F9F2B2C2CC9038D518A5C6B490613E7955BD19D19108B77786986B7ABFE69000"
	assert.Equal(t, expected, hexutils.BytesToHex(data))
}

func TestRemovePadding(t *testing.T) {
	scenarios := []struct {
		data     string
		expected string
	}{
		{
			"0180000000000000",
			"01",
		},
		{
			"0102800000000000",
			"0102",
		},
		{
			"01020304050607080102030405800000",
			"01020304050607080102030405",
		},
	}

	for _, s := range scenarios {
		res := removePadding(8, hexutils.HexToBytes(s.data))
		assert.Equal(t, s.expected, hexutils.BytesToHex(res))
	}
}
