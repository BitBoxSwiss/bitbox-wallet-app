package types

import (
	"bytes"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/status-im/keycard-go/apdu"
)

var (
	TagSignatureTemplate = uint8(0xA0)
)

type Signature struct {
	pubKey []byte
	r      []byte
	s      []byte
	v      byte
}

func ParseSignature(message, resp []byte) (*Signature, error) {
	pubKey, err := apdu.FindTag(resp, apdu.Tag{TagSignatureTemplate}, apdu.Tag{0x80})
	if err != nil {
		return nil, err
	}

	r, err := apdu.FindTagN(resp, 0, apdu.Tag{TagSignatureTemplate}, apdu.Tag{0x30}, apdu.Tag{0x02})
	if err != nil {
		return nil, err
	}

	if len(r) > 32 {
		r = r[len(r)-32:]
	}

	s, err := apdu.FindTagN(resp, 1, apdu.Tag{TagSignatureTemplate}, apdu.Tag{0x30}, apdu.Tag{0x02})
	if err != nil {
		return nil, err
	}

	v, err := calculateV(message, pubKey, r, s)
	if err != nil {
		return nil, err
	}

	return &Signature{
		pubKey: pubKey,
		r:      r,
		s:      s,
		v:      v,
	}, nil
}

func (s *Signature) PubKey() []byte {
	return s.pubKey
}

func (s *Signature) R() []byte {
	return s.r
}

func (s *Signature) S() []byte {
	return s.s
}

func (s *Signature) V() byte {
	return s.v
}

func calculateV(message, pubKey, r, s []byte) (v byte, err error) {
	rs := append(r, s...)
	for i := 0; i < 2; i++ {
		v = byte(i)
		sig := append(rs, v)
		rec, err := crypto.Ecrecover(message, sig)
		if err != nil {
			return v, err
		}

		if bytes.Equal(pubKey, rec) {
			return v, nil
		}
	}

	return v, err
}
