package keycard

import (
	"crypto/rand"
	"crypto/sha256"
	"errors"

	"github.com/status-im/keycard-go/apdu"
	"github.com/status-im/keycard-go/crypto"
	"github.com/status-im/keycard-go/globalplatform"
	"github.com/status-im/keycard-go/identifiers"
	"github.com/status-im/keycard-go/types"
)

var ErrNoAvailablePairingSlots = errors.New("no available pairing slots")

type CommandSet struct {
	c               types.Channel
	sc              *SecureChannel
	ApplicationInfo *types.ApplicationInfo
	PairingInfo     *types.PairingInfo
}

func NewCommandSet(c types.Channel) *CommandSet {
	return &CommandSet{
		c:  c,
		sc: NewSecureChannel(c),
	}
}

func (cs *CommandSet) SetPairingInfo(key []byte, index int) {
	cs.PairingInfo = &types.PairingInfo{
		Key:   key,
		Index: index,
	}
}

func (cs *CommandSet) Select() error {
	instanceAID, err := identifiers.KeycardInstanceAID(identifiers.KeycardDefaultInstanceIndex)
	if err != nil {
		return err
	}

	cmd := globalplatform.NewCommandSelect(instanceAID)
	cmd.SetLe(0)
	resp, err := cs.c.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		cs.ApplicationInfo = &types.ApplicationInfo{}
		return err
	}

	appInfo, err := types.ParseApplicationInfo(resp.Data)
	if err != nil {
		return err
	}

	cs.ApplicationInfo = appInfo

	if cs.ApplicationInfo.HasSecureChannelCapability() {
		err = cs.sc.GenerateSecret(cs.ApplicationInfo.SecureChannelPublicKey)
		if err != nil {
			return err
		}

		cs.sc.Reset()
	}

	return nil
}

func (cs *CommandSet) Init(secrets *Secrets) error {
	data, err := cs.sc.OneShotEncrypt(secrets)
	if err != nil {
		return err
	}

	init := NewCommandInit(data)
	resp, err := cs.c.Send(init)

	return cs.checkOK(resp, err)
}

func (cs *CommandSet) Pair(pairingPass string) error {
	challenge := make([]byte, 32)
	if _, err := rand.Read(challenge); err != nil {
		return err
	}

	cmd := NewCommandPairFirstStep(challenge)
	resp, err := cs.c.Send(cmd)
	if resp.Sw == SwNoAvailablePairingSlots {
		return ErrNoAvailablePairingSlots
	}

	if err = cs.checkOK(resp, err); err != nil {
		return err
	}

	cardCryptogram := resp.Data[:32]
	cardChallenge := resp.Data[32:]

	secretHash, err := crypto.VerifyCryptogram(challenge, pairingPass, cardCryptogram)
	if err != nil {
		return err
	}

	h := sha256.New()
	h.Write(secretHash[:])
	h.Write(cardChallenge)
	cmd = NewCommandPairFinalStep(h.Sum(nil))
	resp, err = cs.c.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		return err
	}

	h.Reset()
	h.Write(secretHash[:])
	h.Write(resp.Data[1:])

	pairingKey := h.Sum(nil)
	pairingIndex := resp.Data[0]

	cs.PairingInfo = &types.PairingInfo{
		Key:   pairingKey,
		Index: int(pairingIndex),
	}

	return nil
}

func (cs *CommandSet) Unpair(index uint8) error {
	cmd := NewCommandUnpair(index)
	resp, err := cs.sc.Send(cmd)
	return cs.checkOK(resp, err)
}

func (cs *CommandSet) OpenSecureChannel() error {
	if cs.ApplicationInfo == nil {
		return errors.New("cannot open secure channel without setting PairingInfo")
	}

	cmd := NewCommandOpenSecureChannel(uint8(cs.PairingInfo.Index), cs.sc.RawPublicKey())
	resp, err := cs.c.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		return err
	}

	encKey, macKey, iv := crypto.DeriveSessionKeys(cs.sc.Secret(), cs.PairingInfo.Key, resp.Data)
	cs.sc.Init(iv, encKey, macKey)

	err = cs.mutualAuthenticate()
	if err != nil {
		return err
	}

	return nil
}

func (cs *CommandSet) GetStatus(info uint8) (*types.ApplicationStatus, error) {
	cmd := NewCommandGetStatus(info)
	resp, err := cs.sc.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		return nil, err
	}

	return types.ParseApplicationStatus(resp.Data)
}

func (cs *CommandSet) GetStatusApplication() (*types.ApplicationStatus, error) {
	return cs.GetStatus(P1GetStatusApplication)
}

func (cs *CommandSet) GetStatusKeyPath() (*types.ApplicationStatus, error) {
	return cs.GetStatus(P1GetStatusKeyPath)
}

func (cs *CommandSet) VerifyPIN(pin string) error {
	cmd := NewCommandVerifyPIN(pin)
	resp, err := cs.sc.Send(cmd)

	return cs.checkOK(resp, err)
}

func (cs *CommandSet) ChangePIN(pin string) error {
	cmd := NewCommandChangePIN(pin)
	resp, err := cs.sc.Send(cmd)

	return cs.checkOK(resp, err)
}

func (cs *CommandSet) ChangePUK(puk string) error {
	cmd := NewCommandChangePUK(puk)
	resp, err := cs.sc.Send(cmd)

	return cs.checkOK(resp, err)
}

func (cs *CommandSet) ChangePairingSecret(password string) error {
	secret := generatePairingToken(password)
	cmd := NewCommandChangePairingSecret(secret)
	resp, err := cs.sc.Send(cmd)

	return cs.checkOK(resp, err)
}

func (cs *CommandSet) GenerateKey() ([]byte, error) {
	cmd := NewCommandGenerateKey()
	resp, err := cs.sc.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		return nil, err
	}

	return resp.Data, nil
}

func (cs *CommandSet) RemoveKey() error {
	cmd := NewCommandRemoveKey()
	resp, err := cs.sc.Send(cmd)
	return cs.checkOK(resp, err)
}

func (cs *CommandSet) DeriveKey(path string) error {
	cmd, err := NewCommandDeriveKey(path)
	if err != nil {
		return err
	}

	resp, err := cs.sc.Send(cmd)
	return cs.checkOK(resp, err)
}

func (cs *CommandSet) ExportKey(derive bool, makeCurrent bool, onlyPublic bool, path string) ([]byte, error) {
	var p1 uint8
	if derive == false {
		p1 = P1ExportKeyCurrent
	} else if makeCurrent == false {
		p1 = P1ExportKeyDerive
	} else {
		p1 = P1ExportKeyDeriveAndMakeCurrent
	}
	var p2 uint8
	if onlyPublic == true {
		p2 = P2ExportKeyPublicOnly
	} else {
		p2 = P2ExportKeyPrivateAndPublic
	}
	cmd, err := NewCommandExportKey(p1, p2, path)
	if err != nil {
		return nil, err
	}

	resp, err := cs.sc.Send(cmd)
	err = cs.checkOK(resp, err)
	if err != nil {
		return nil, err
	}
	return resp.Data, nil

}

func (cs *CommandSet) SetPinlessPath(path string) error {
	cmd, err := NewCommandSetPinlessPath(path)
	if err != nil {
		return err
	}

	resp, err := cs.sc.Send(cmd)
	return cs.checkOK(resp, err)
}

func (cs *CommandSet) Sign(data []byte) (*types.Signature, error) {
	cmd, err := NewCommandSign(data, P1SignCurrentKey)
	if err != nil {
		return nil, err
	}

	resp, err := cs.sc.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		return nil, err
	}

	return types.ParseSignature(data, resp.Data)
}

func (cs *CommandSet) SignPinless(data []byte) (*types.Signature, error) {
	cmd, err := NewCommandSign(data, P1SignPinless)
	if err != nil {
		return nil, err
	}

	resp, err := cs.c.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		return nil, err
	}

	return types.ParseSignature(data, resp.Data)
}

func (cs *CommandSet) mutualAuthenticate() error {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return err
	}

	cmd := NewCommandMutuallyAuthenticate(data)
	resp, err := cs.sc.Send(cmd)

	return cs.checkOK(resp, err)
}

func (cs *CommandSet) checkOK(resp *apdu.Response, err error, allowedResponses ...uint16) error {
	if err != nil {
		return err
	}

	if len(allowedResponses) == 0 {
		allowedResponses = []uint16{apdu.SwOK}
	}

	for _, code := range allowedResponses {
		if code == resp.Sw {
			return nil
		}
	}

	return apdu.NewErrBadResponse(resp.Sw, "unexpected response")
}
