package keycard

import (
	"bytes"
	"crypto/ecdsa"
	"errors"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/status-im/keycard-go/apdu"
	"github.com/status-im/keycard-go/crypto"
	"github.com/status-im/keycard-go/globalplatform"
	"github.com/status-im/keycard-go/hexutils"
	"github.com/status-im/keycard-go/types"
)

var ErrInvalidResponseMAC = errors.New("invalid response MAC")

type SecureChannel struct {
	c         types.Channel
	open      bool
	secret    []byte
	publicKey *ecdsa.PublicKey
	encKey    []byte
	macKey    []byte
	iv        []byte
}

func NewSecureChannel(c types.Channel) *SecureChannel {
	return &SecureChannel{
		c: c,
	}
}

func (sc *SecureChannel) GenerateSecret(cardPubKeyData []byte) error {
	key, err := ethcrypto.GenerateKey()
	if err != nil {
		return err
	}

	cardPubKey, err := ethcrypto.UnmarshalPubkey(cardPubKeyData)
	if err != nil {
		return err
	}

	sc.publicKey = &key.PublicKey
	sc.secret = crypto.GenerateECDHSharedSecret(key, cardPubKey)

	return nil
}

func (sc *SecureChannel) Reset() {
	sc.open = false
}

func (sc *SecureChannel) Init(iv, encKey, macKey []byte) {
	sc.iv = iv
	sc.encKey = encKey
	sc.macKey = macKey
	sc.open = true
}

func (sc *SecureChannel) Secret() []byte {
	return sc.secret
}

func (sc *SecureChannel) PublicKey() *ecdsa.PublicKey {
	return sc.publicKey
}

func (sc *SecureChannel) RawPublicKey() []byte {
	return ethcrypto.FromECDSAPub(sc.publicKey)
}

func (sc *SecureChannel) Send(cmd *apdu.Command) (*apdu.Response, error) {
	if sc.open {
		encData, err := crypto.EncryptData(cmd.Data, sc.encKey, sc.iv)
		if err != nil {
			return nil, err
		}

		meta := []byte{cmd.Cla, cmd.Ins, cmd.P1, cmd.P2, byte(len(encData) + 16), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
		if err = sc.updateIV(meta, encData); err != nil {
			return nil, err
		}

		newData := append(sc.iv, encData...)
		cmd.Data = newData
	}

	resp, err := sc.c.Send(cmd)
	if err != nil {
		return nil, err
	}

	if resp.Sw != globalplatform.SwOK {
		return nil, apdu.NewErrBadResponse(resp.Sw, "unexpected sw in secure channel")
	}

	rmeta := []byte{byte(len(resp.Data)), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
	rmac := resp.Data[:len(sc.iv)]
	rdata := resp.Data[len(sc.iv):]
	plainData, err := crypto.DecryptData(rdata, sc.encKey, sc.iv)
	if err = sc.updateIV(rmeta, rdata); err != nil {
		return nil, err
	}

	if !bytes.Equal(sc.iv, rmac) {
		return nil, ErrInvalidResponseMAC
	}

	logger.Debug("apdu response decrypted", "hex", hexutils.BytesToHexWithSpaces(plainData))

	return apdu.ParseResponse(plainData)
}

func (sc *SecureChannel) updateIV(meta, data []byte) error {
	mac, err := crypto.CalculateMac(meta, data, sc.macKey)
	if err != nil {
		return err
	}

	sc.iv = mac

	return nil
}

func (sc *SecureChannel) OneShotEncrypt(secrets *Secrets) ([]byte, error) {
	pubKeyData := ethcrypto.FromECDSAPub(sc.publicKey)
	data := append([]byte(secrets.Pin()), []byte(secrets.Puk())...)
	data = append(data, secrets.PairingToken()...)

	return crypto.OneShotEncrypt(pubKeyData, sc.secret, data)
}
