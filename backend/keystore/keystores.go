package keystore

import (
	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/backend/coins/coin"
	"github.com/shiftdevices/godbb/backend/signing"
	"github.com/shiftdevices/godbb/util/errp"
)

// Keystores models a collection of keystores that can be passed from a wallet to its accounts.
type Keystores interface {
	// Count returns the number of keystores in the collection.
	Count() int

	// Add adds the given keystore to the collection of keystores.
	Add(Keystore) error

	// Remove removes the given keystore from the collection of keystores.
	Remove(Keystore) error

	// HaveSecureOutput returns whether any of the keystores has a secure output.
	HaveSecureOutput() bool

	// OutputAddress outputs the address for the given coin at the given keypath on all keystores
	// that have a secure output.
	OutputAddress(signing.AbsoluteKeypath, coin.Coin) error

	// SignTransaction signs the given proposed transaction on all keystores.
	SignTransaction(coin.ProposedTransaction) (coin.ProposedTransaction, error)

	// Configuration returns the configuration at the given path with the given signing threshold.
	Configuration(signing.AbsoluteKeypath, int) (*signing.Configuration, error)
}

type implementation struct {
	keystores []Keystore
}

// NewKeystores returns a collection of the given keystores.
func NewKeystores(keystores ...Keystore) Keystores {
	return &implementation{
		keystores: keystores,
	}
}

// Count implements the above interface.
func (keystores *implementation) Count() int {
	return len(keystores.keystores)
}

// Add implements the above interface.
func (keystores *implementation) Add(keystore Keystore) error {
	for _, element := range keystores.keystores {
		if element == keystore {
			return errp.New("The collection already contains the given keystore.")
		}
	}
	keystores.keystores = append(keystores.keystores, keystore)
	return nil
}

// Remove implements the above interface.
func (keystores *implementation) Remove(keystore Keystore) error {
	for index, element := range keystores.keystores {
		if element == keystore {
			indexOfLastElement := len(keystores.keystores) - 1
			keystores.keystores[index] = keystores.keystores[indexOfLastElement]
			keystores.keystores[indexOfLastElement] = nil // Prevent memory leak
			keystores.keystores = keystores.keystores[:indexOfLastElement]
			return nil
		}
	}
	return errp.New("The collection does not contain the given keystore.")
}

// HaveSecureOutput implements the above interface.
func (keystores *implementation) HaveSecureOutput() bool {
	for _, keystore := range keystores.keystores {
		if keystore.HasSecureOutput() {
			return true
		}
	}
	return false
}

// OutputAddress implements the above interface.
func (keystores *implementation) OutputAddress(
	keypath signing.AbsoluteKeypath,
	coin coin.Coin,
) error {
	found := false
	for _, keystore := range keystores.keystores {
		if keystore.HasSecureOutput() {
			if err := keystore.OutputAddress(keypath, coin); err != nil {
				return err
			}
			found = true
		}
	}
	if !found {
		return errp.New("There is currently no keystore to securely output the address.")
	}
	return nil
}

// SignTransaction implements the above interface.
func (keystores *implementation) SignTransaction(
	proposedTransaction coin.ProposedTransaction,
) (coin.ProposedTransaction, error) {
	for _, keystore := range keystores.keystores {
		var err error
		proposedTransaction, err = keystore.SignTransaction(proposedTransaction)
		if err != nil {
			return nil, err
		}
	}
	return proposedTransaction, nil
}

// Configuration implements the above interface.
func (keystores *implementation) Configuration(
	absoluteKeypath signing.AbsoluteKeypath,
	signingThreshold int,
) (*signing.Configuration, error) {
	extendedPublicKeys := make([]*hdkeychain.ExtendedKey, len(keystores.keystores))
	for index, keystore := range keystores.keystores {
		if keystore.CosignerIndex() != index {
			return nil, errp.New("The keystores are in the wrong order.")
		}
		extendedPublicKey, err := keystore.ExtendedPublicKey(absoluteKeypath)
		if err != nil {
			return nil, err
		}
		extendedPublicKeys[index] = extendedPublicKey
	}
	return signing.NewConfiguration(absoluteKeypath, extendedPublicKeys, signingThreshold), nil
}
