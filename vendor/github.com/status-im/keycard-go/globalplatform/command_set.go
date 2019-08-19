package globalplatform

import (
	"crypto/rand"
	"errors"
	"os"

	"github.com/status-im/keycard-go/apdu"
	"github.com/status-im/keycard-go/identifiers"
	"github.com/status-im/keycard-go/types"
)

var ErrSecureChannelNotOpen = errors.New("secure channel not open")

type LoadingCallback = func(loadingBlock, totalBlocks int)

type CommandSet struct {
	c       types.Channel
	sc      *SecureChannel
	session *Session
}

func NewCommandSet(c types.Channel) *CommandSet {
	return &CommandSet{
		c: c,
	}
}

func (cs *CommandSet) Select() error {
	return cs.SelectAID(nil)
}

func (cs *CommandSet) SelectAID(aid []byte) error {
	cmd := NewCommandSelect(aid)
	cmd.SetLe(0)
	resp, err := cs.c.Send(cmd)

	return cs.checkOK(resp, err)
}

func (cs *CommandSet) OpenSecureChannel() error {
	hostChallenge, err := generateHostChallenge()
	if err != nil {
		return err
	}

	err = cs.initializeUpdate(hostChallenge)
	if err != nil {
		return err
	}

	return cs.externalAuthenticate()
}

func (cs *CommandSet) DeleteKeycardInstancesAndPackage() error {
	if cs.sc == nil {
		return ErrSecureChannelNotOpen
	}

	instanceAID, err := identifiers.KeycardInstanceAID(identifiers.KeycardDefaultInstanceIndex)
	if err != nil {
		return err
	}

	ids := [][]byte{
		identifiers.NdefInstanceAID,
		instanceAID,
		identifiers.PackageAID,
	}

	for _, aid := range ids {
		err := cs.Delete(aid)
		if err != nil {
			return err
		}
	}

	return nil
}

func (cs *CommandSet) Delete(aid []byte) error {
	cmd := NewCommandDelete(aid)
	resp, err := cs.sc.Send(cmd)
	return cs.checkOK(resp, err, SwOK, SwReferencedDataNotFound)
}

func (cs *CommandSet) LoadKeycardPackage(capFile *os.File, callback LoadingCallback) error {
	return cs.LoadPackage(capFile, identifiers.PackageAID, callback)
}

func (cs *CommandSet) LoadPackage(capFile *os.File, pkgAID []byte, callback LoadingCallback) error {
	if cs.sc == nil {
		return ErrSecureChannelNotOpen
	}

	preLoad := NewCommandInstallForLoad(pkgAID, []byte{})
	resp, err := cs.sc.Send(preLoad)
	if err = cs.checkOK(resp, err); err != nil {
		return err
	}

	load, err := NewLoadCommandStream(capFile)
	if err != nil {
		return err
	}

	for load.Next() {
		cmd := load.GetCommand()
		callback(int(load.Index()), load.BlocksCount())
		resp, err = cs.sc.Send(cmd)
		if err = cs.checkOK(resp, err); err != nil {
			return err
		}
	}

	return nil
}

func (cs *CommandSet) InstallNDEFApplet(ndefRecord []byte) error {
	return cs.InstallForInstall(
		identifiers.PackageAID,
		identifiers.NdefAID,
		identifiers.NdefInstanceAID,
		ndefRecord)
}

func (cs *CommandSet) InstallKeycardApplet() error {
	instanceAID, err := identifiers.KeycardInstanceAID(identifiers.KeycardDefaultInstanceIndex)
	if err != nil {
		return err
	}

	return cs.InstallForInstall(
		identifiers.PackageAID,
		identifiers.KeycardAID,
		instanceAID,
		[]byte{})
}

func (cs *CommandSet) InstallForInstall(packageAID, appletAID, instanceAID, params []byte) error {
	cmd := NewCommandInstallForInstall(packageAID, appletAID, instanceAID, params)
	resp, err := cs.sc.Send(cmd)
	return cs.checkOK(resp, err)
}

func (cs *CommandSet) GetStatus() (*types.CardStatus, error) {
	cmd := NewCommandGetStatus([]byte{}, P1GetStatusIssuerSecurityDomain)
	resp, err := cs.sc.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		return nil, err
	}

	return types.ParseCardStatus(resp.Data)
}

func (cs *CommandSet) Channel() types.Channel {
	return cs.c
}

func (cs *CommandSet) SecureChannel() *SecureChannel {
	return cs.sc
}

func (cs *CommandSet) initializeUpdate(hostChallenge []byte) error {
	cmd := NewCommandInitializeUpdate(hostChallenge)
	resp, err := cs.c.Send(cmd)
	if err = cs.checkOK(resp, err); err != nil {
		return err
	}

	// verify cryptogram and initialize session keys
	session, err := cs.initializeSession(resp, hostChallenge)
	if err != nil {
		return err
	}

	cs.sc = NewSecureChannel(session, cs.c)
	cs.session = session

	return nil
}

func (cs *CommandSet) initializeSession(resp *apdu.Response, hostChallenge []byte) (session *Session, err error) {
	keySets := []struct {
		name string
		key  []byte
	}{
		{"keycard", identifiers.KeycardDevelopmentKey},
		{"globalplatform", identifiers.GlobalPlatformDefaultKey},
	}

	for _, set := range keySets {
		logger.Debug("initialize session", "keys", set.name)
		keys := NewSCP02Keys(set.key, set.key)
		session, err = NewSession(keys, resp, hostChallenge)

		// good keys
		if err == nil {
			break
		}

		// try the next keys
		if err == errBadCryptogram {
			continue
		}

		// unexpected error
		return nil, err
	}

	return session, err
}

func (cs *CommandSet) externalAuthenticate() error {
	if cs.session == nil {
		return errors.New("session must be initialized using initializeUpdate")
	}

	encKey := cs.session.Keys().Enc()
	cmd, err := NewCommandExternalAuthenticate(encKey, cs.session.CardChallenge(), cs.session.HostChallenge())
	if err != nil {
		return err
	}

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

func generateHostChallenge() ([]byte, error) {
	c := make([]byte, 8)
	_, err := rand.Read(c)
	return c, err
}
