package globalplatform

import (
	"errors"
	"fmt"

	"github.com/status-im/keycard-go/apdu"
	"github.com/status-im/keycard-go/globalplatform/crypto"
)

const supportedSCPVersion = 2

// Session is a struct containing the keys and challenges used in the current communication with a card.
type Session struct {
	keys          *SCP02Keys
	cardChallenge []byte
	hostChallenge []byte
}

var errBadCryptogram = errors.New("bad card cryptogram")

// NewSession returns a new session after validating the cryptogram received from the card.
func NewSession(cardKeys *SCP02Keys, resp *apdu.Response, hostChallenge []byte) (*Session, error) {
	if resp.Sw == SwSecurityConditionNotSatisfied {
		return nil, apdu.NewErrBadResponse(resp.Sw, "security condition not satisfied")
	}

	if resp.Sw == SwAuthenticationMethodBlocked {
		return nil, apdu.NewErrBadResponse(resp.Sw, "authentication method blocked")
	}

	if len(resp.Data) != 28 {
		return nil, apdu.NewErrBadResponse(resp.Sw, fmt.Sprintf("bad data length, expected 28, got %d", len(resp.Data)))
	}

	scpMajorVersion := resp.Data[11]
	if scpMajorVersion != supportedSCPVersion {
		return nil, fmt.Errorf("scp version %d not supported", scpMajorVersion)
	}

	cardChallenge := resp.Data[12:20]
	cardCryptogram := resp.Data[20:28]
	seq := resp.Data[12:14]

	sessionEncKey, err := crypto.DeriveKey(cardKeys.Enc(), seq, crypto.DerivationPurposeEnc)
	if err != nil {
		return nil, err
	}

	sessionMacKey, err := crypto.DeriveKey(cardKeys.Enc(), seq, crypto.DerivationPurposeMac)
	if err != nil {
		return nil, err
	}

	sessionKeys := NewSCP02Keys(sessionEncKey, sessionMacKey)
	verified, err := crypto.VerifyCryptogram(sessionKeys.Enc(), hostChallenge, cardChallenge, cardCryptogram)
	if err != nil {
		return nil, err
	}

	if !verified {
		return nil, errBadCryptogram
	}

	s := &Session{
		keys:          sessionKeys,
		cardChallenge: cardChallenge,
		hostChallenge: hostChallenge,
	}

	return s, nil
}

// Keys return the current SCP02Keys.
func (s *Session) Keys() *SCP02Keys {
	return s.keys
}

// CardChallenge returns the current card challenge.
func (s *Session) CardChallenge() []byte {
	return s.cardChallenge
}

// HostChallenge returns the current host challenge.
func (s *Session) HostChallenge() []byte {
	return s.hostChallenge
}
