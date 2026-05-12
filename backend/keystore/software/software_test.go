// SPDX-License-Identifier: Apache-2.0

package software

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

func makeRootXprv(t *testing.T) *hdkeychain.ExtendedKey {
	t.Helper()
	// Xprv derived from BIP39 mnemonic (no passphrase):
	// awkward squirrel wait rubber biology escape toe daring still pause fitness vendor
	rootXprv, err := hdkeychain.NewKeyFromString("xprv9s21ZrQH143K3uDh9hiNXB3a9GVzcCujEmCwmZA9g8m4i5nUDVdLHJjsLMPzV26vj8Q7ceGrUhX119Y3XzGhJqq5K6LWP1h6gjv2cbkMEH1")
	require.NoError(t, err)
	return rootXprv
}

func makeKeystore(t *testing.T) *Keystore {
	t.Helper()
	rootXprv := makeRootXprv(t)
	return NewKeystore(rootXprv)
}

func TestRootFingerprint(t *testing.T) {
	keystore := makeKeystore(t)
	rootFingerprint, err := keystore.RootFingerprint()
	require.NoError(t, err)
	// Verified by comparing to the root fingerprint produced by the BitBox02 and Electrum.
	require.Equal(t, []byte{0xfb, 0x70, 0x89, 0xbd}, rootFingerprint)
}

func TestCanSignMessage(t *testing.T) {
	keystore := makeKeystore(t)

	require.True(t, keystore.CanSignMessage(coin.CodeBTC))
	require.True(t, keystore.CanSignMessage(coin.CodeTBTC))
	require.True(t, keystore.CanSignMessage(coin.CodeRBTC))
	require.True(t, keystore.CanSignMessage(coin.CodeETH))
	require.True(t, keystore.CanSignMessage(coin.CodeSEPETH))
	require.False(t, keystore.CanSignMessage(coin.CodeLTC))
}

func TestEditionSupport(t *testing.T) {
	btcCoin := btc.NewCoin(coin.CodeTBTC, "Bitcoin Testnet", "TBTC", coin.BtcUnitDefault, &chaincfg.TestNet3Params, ".", []*config.ServerInfo{}, "", socksproxy.NewSocksProxy(false, ""))
	ltcCoin := btc.NewCoin(coin.CodeTLTC, "Litecoin Testnet", "TLTC", coin.BtcUnitDefault, &chaincfg.TestNet3Params, ".", []*config.ServerInfo{}, "", socksproxy.NewSocksProxy(false, ""))
	ethCoin := eth.NewCoin(nil, coin.CodeSEPETH, "Sepolia", "ETH", "ETH", params.SepoliaChainConfig, "", nil, nil)

	multi := NewKeystoreWithEdition(makeRootXprv(t), EditionMulti)
	require.True(t, multi.SupportsCoin(btcCoin))
	require.True(t, multi.SupportsCoin(ltcCoin))
	require.True(t, multi.SupportsCoin(ethCoin))
	require.True(t, multi.CanSignMessage(coin.CodeSEPETH))

	btcOnly := NewKeystoreWithEdition(makeRootXprv(t), EditionBTCOnly)
	require.True(t, btcOnly.SupportsCoin(btcCoin))
	require.True(t, btcOnly.SupportsAccount(btcCoin, signing.ScriptTypeP2WPKH))
	require.False(t, btcOnly.SupportsCoin(ltcCoin))
	require.False(t, btcOnly.SupportsCoin(ethCoin))
	require.False(t, btcOnly.SupportsAccount(ethCoin, nil))
	require.True(t, btcOnly.CanSignMessage(coin.CodeTBTC))
	require.False(t, btcOnly.CanSignMessage(coin.CodeSEPETH))

	keypath, err := signing.NewAbsoluteKeypath("m/44'/60'/0'/0/0")
	require.NoError(t, err)
	_, err = btcOnly.SignETHMessage(11155111, []byte("hello eth"), keypath)
	require.EqualError(t, err, "coin not supported: eth")
}

func TestSignBTCMessage(t *testing.T) {
	keystore := makeKeystore(t)
	keypath, err := signing.NewAbsoluteKeypath("m/84'/1'/0'/0/0")
	require.NoError(t, err)

	signature, err := keystore.SignBTCMessage([]byte("hello tbtc"), keypath, signing.ScriptTypeP2WPKH, coin.CodeTBTC)
	require.NoError(t, err)
	require.Len(t, signature, 65)

	xprv, err := keypath.Derive(keystore.master)
	require.NoError(t, err)
	expectedPriv, err := xprv.ECPrivKey()
	require.NoError(t, err)

	msgHash, err := btcMessageHash([]byte("hello tbtc"))
	require.NoError(t, err)
	recoveredPub, _, err := ecdsa.RecoverCompact(signature, msgHash)
	require.NoError(t, err)
	require.Equal(t, expectedPriv.PubKey().SerializeCompressed(), recoveredPub.SerializeCompressed())
}

func TestSignBTCMessageUnsupported(t *testing.T) {
	keystore := makeKeystore(t)
	keypath, err := signing.NewAbsoluteKeypath("m/84'/1'/0'/0/0")
	require.NoError(t, err)

	_, err = keystore.SignBTCMessage([]byte("hello"), keypath, signing.ScriptTypeP2TR, coin.CodeTBTC)
	require.EqualError(t, err, "taproot not supported")

	_, err = keystore.SignBTCMessage([]byte("hello"), keypath, signing.ScriptTypeP2WPKH, coin.CodeLTC)
	require.EqualError(t, err, "coin not supported: ltc")
}

func TestSignTransactionBTCOnlyRejectsLitecoin(t *testing.T) {
	keystore := NewKeystoreWithEdition(makeRootXprv(t), EditionBTCOnly)
	ltcCoin := btc.NewCoin(coin.CodeTLTC, "Litecoin Testnet", "TLTC", coin.BtcUnitDefault, &chaincfg.TestNet3Params, ".", []*config.ServerInfo{}, "", socksproxy.NewSocksProxy(false, ""))

	err := keystore.SignTransaction(&btc.ProposedTransaction{
		TXProposal: &maketx.TxProposal{
			Coin: ltcCoin,
		},
	})

	require.EqualError(t, err, "coin not supported: tltc")
}

func TestSignETHMessage(t *testing.T) {
	keystore := makeKeystore(t)
	keypath, err := signing.NewAbsoluteKeypath("m/44'/60'/0'/0/0")
	require.NoError(t, err)
	message := []byte("hello eth")

	signature, err := keystore.SignETHMessage(11155111, message, keypath)
	require.NoError(t, err)
	require.Len(t, signature, 65)
	require.Contains(t, []byte{27, 28}, signature[64])

	signatureForRecovery := append([]byte(nil), signature...)
	signatureForRecovery[64] -= 27
	recoveredPub, err := crypto.SigToPub(accounts.TextHash(message), signatureForRecovery)
	require.NoError(t, err)

	xprv, err := keypath.Derive(keystore.master)
	require.NoError(t, err)
	expectedPriv, err := xprv.ECPrivKey()
	require.NoError(t, err)
	require.Equal(
		t,
		crypto.FromECDSAPub(&expectedPriv.ToECDSA().PublicKey),
		crypto.FromECDSAPub(recoveredPub),
	)
}
