// SPDX-License-Identifier: Apache-2.0

package keystore

import (
	"errors"

	btctypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/ethereum/go-ethereum/core/types"
)

// Type denotes the type of a keystore.
type Type string

const (
	// TypeHardware means the keystore is provided by a hardware wallet.
	TypeHardware Type = "hardware"
	// TypeSoftware mans the keystore is provided by a software (hot) wallet. Currently only used in
	// devmode for testing.
	TypeSoftware Type = "software"
)

// KeystoreError represents errors related to the keystore.
//
//revive:disable-line:exported
type KeystoreError string //revive:disable-line:exported

func (err KeystoreError) Error() string {
	return string(err)
}

var (
	// ErrFirmwareUpgradeRequired is returned when the keystore device needs a FW upgrade.
	ErrFirmwareUpgradeRequired = KeystoreError("firmwareUpgradeRequired")
	// ErrUnsupportedFeature is returned when a certain feature is unsupported by the keystore.
	ErrUnsupportedFeature = KeystoreError("unsupportedFeature")
)

// ErrSigningAborted is used when the user aborts a signing in process (e.g. abort on HW wallet).
var ErrSigningAborted = errors.New("signing aborted by user")

// Keystore supports hardened key derivation according to BIP32 and signing of transactions.
//
//go:generate moq -pkg mocks -out mocks/keystore.go . Keystore
type Keystore interface {
	// Type denotes the type of the keystore.
	Type() Type

	// Returns the name of the keystore, e.g. the BitBox02 device name.
	Name() (string, error)

	// RootFingerprint returns the keystore's root fingerprint, which is the first 32 bits of the
	// hash160 of the pubkey at the keypath m/.
	//
	// https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#key-identifiers
	RootFingerprint() ([]byte, error)

	// SupportsCoin returns true if the keystore supports at least one account type for this coin.
	SupportsCoin(coinInstance coin.Coin) bool

	// SupportsAccount returns true if they keystore supports the given coin/account.
	// meta is a coin-specific metadata related to the account type.
	SupportsAccount(coinInstance coin.Coin, meta interface{}) bool

	// SupportsMultipleAccounts returns true if the keystore can handle more than one account per
	// coin.
	SupportsMultipleAccounts() bool

	// CanVerifyAddress returns whether the keystore supports to output an address securely.
	// This is typically done through a screen on the device or through a paired mobile phone.
	// optional is true if the user can skip verification, and false if they should be forced to
	// verify.
	CanVerifyAddress(coin.Coin) (secureOutput bool, optional bool, err error)

	// VerifyAddressBTC displays a Bitcoin address for verification.
	// Please note that this is only supported if the keystore has a secure output channel.
	VerifyAddressBTC(
		accountConfiguration *signing.Configuration,
		derivation btctypes.Derivation,
		coin coin.Coin) error

	// VerifyAddressBTC displays an Ethereum address for verification.
	// Please note that this is only supported if the keystore has a secure output channel.
	VerifyAddressETH(*signing.Configuration, coin.Coin) error

	// CanVerifyExtendedPublicKey returns whether the keystore supports to output an xpub/zpub/tbup/ypub securely.
	CanVerifyExtendedPublicKey() bool

	// VerifyExtendedPublicKey displays the public key on the device for verification
	VerifyExtendedPublicKey(coin.Coin, *signing.Configuration) error

	// ExtendedPublicKey returns the extended public key at the given absolute keypath.
	ExtendedPublicKey(coin.Coin, signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error)

	// BTCXPubs returns the xpubs at the given keypaths. It attempts to fetch them in one go if
	// possible.
	BTCXPubs(coin.Coin, []signing.AbsoluteKeypath) ([]*hdkeychain.ExtendedKey, error)

	// CanSignMessage returns true if the keystore can sign a message for a coin.
	CanSignMessage(coin.Code) bool

	// SignBTCMessage signs the message using the private key at the keypath. The scriptType is
	// required to compute and verify the address. The returned signature is a 65 byte signature in
	// Electrum format.
	SignBTCMessage(message []byte, keypath signing.AbsoluteKeypath, scriptType signing.ScriptType, coin coin.Code) ([]byte, error)

	// SignETHMessage signs the message using the private key at the keypath. The result contains a
	// 65 byte signature. The first 64 bytes are the secp256k1 signature in / compact format (R and
	// S values), and the last byte is the recoverable id (recid). 27 is added to the recID to denote
	// an uncompressed pubkey. Returns ErrSigningAborted if the user aborts.
	SignETHMessage(message []byte, keypath signing.AbsoluteKeypath) ([]byte, error)

	// ETHSignTypedMessage signs an Ethereum EIP-712 typed message. The result contains a
	// 65 byte signature. The first 64 bytes are the secp256k1 signature in / compact format (R and
	// S values), and the last byte is the recoverable id (recid). 27 is added to the recID to denote
	// an uncompressed pubkey. Returns ErrSigningAborted if the user aborts.
	SignETHTypedMessage(chainID uint64, data []byte, keypath signing.AbsoluteKeypath) ([]byte, error)

	// SignTransaction signs the given transaction proposal. Returns ErrSigningAborted if the user
	// aborts.
	SignTransaction(interface{}) error

	// SignETHWalletConnectTransaction signs a transaction proposed by Wallet Connect. Returns ErrSigningAborted if the user
	// aborts.
	SignETHWalletConnectTransaction(chainID uint64, tx *types.Transaction, keypath signing.AbsoluteKeypath) ([]byte, error)

	// SupportsEIP1559 returns whether the keystore supports EIP1559 type 2 transactions for Ethereum
	SupportsEIP1559() bool

	// SupportsPaymentRequests returns nil if the device supports silent payments, or an error indicating why it is not supported.
	SupportsPaymentRequests() error

	// Features reports optional capabilities supported by this keystore.
	Features() *Features
}

// Features enumerates optional capabilities that can differ per keystore implementation.
type Features struct {
	// SupportsSendToSelf indicates whether the keystore can explicitly verify outputs that belong to
	// the same keystore (used for the send-to-self recipient dropdown flow).
	SupportsSendToSelf bool `json:"supportsSendToSelf"`
}
