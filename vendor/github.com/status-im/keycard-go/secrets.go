package keycard

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"math/big"

	"github.com/status-im/keycard-go/crypto"
	"golang.org/x/crypto/pbkdf2"
	"golang.org/x/text/unicode/norm"
)

const (
	maxPukNumber = int64(999999999999)
	maxPinNumber = int64(999999)
)

// Secrets contains the secret data needed to pair a client with a card.
type Secrets struct {
	pin          string
	puk          string
	pairingPass  string
	pairingToken []byte
}

func NewSecrets(pin, puk, pairingPass string) *Secrets {
	return &Secrets{
		pin:          pin,
		puk:          puk,
		pairingPass:  pairingPass,
		pairingToken: generatePairingToken(pairingPass),
	}
}

// GenerateSecrets generate a new Secrets with  random puk and pairing password.
func GenerateSecrets() (*Secrets, error) {
	pairingPass, err := generatePairingPass()
	if err != nil {
		return nil, err
	}

	puk, err := rand.Int(rand.Reader, big.NewInt(maxPukNumber))
	if err != nil {
		return nil, err
	}

	pin, err := rand.Int(rand.Reader, big.NewInt(maxPinNumber))
	if err != nil {
		return nil, err
	}

	return &Secrets{
		pin:          fmt.Sprintf("%06d", pin.Int64()),
		puk:          fmt.Sprintf("%012d", puk.Int64()),
		pairingPass:  pairingPass,
		pairingToken: generatePairingToken(pairingPass),
	}, nil
}

// Pin returns the pin string.
func (s *Secrets) Pin() string {
	return s.pin
}

// Puk returns the puk string.
func (s *Secrets) Puk() string {
	return s.puk
}

// PairingPass returns the pairing password string.
func (s *Secrets) PairingPass() string {
	return s.pairingPass
}

// PairingToken returns the pairing token generated from the random pairing password.
func (s *Secrets) PairingToken() []byte {
	return s.pairingToken
}

func generatePairingPass() (string, error) {
	r := make([]byte, 12)
	_, err := rand.Read(r)
	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(r), nil
}

func generatePairingToken(pass string) []byte {
	return pbkdf2.Key(norm.NFKD.Bytes([]byte(pass)), norm.NFKD.Bytes([]byte(crypto.PairingTokenSalt)), 50000, 32, sha256.New)
}
