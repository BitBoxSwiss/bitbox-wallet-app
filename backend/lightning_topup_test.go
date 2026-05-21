// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/stretchr/testify/require"
)

func setTestLightningAccount(t *testing.T, b *Backend, rootFingerprint []byte) {
	t.Helper()
	require.NoError(t, b.Lightning().SetAccount(&config.LightningAccountConfig{
		Mnemonic:        "test mnemonic",
		RootFingerprint: append([]byte(nil), rootFingerprint...),
		Code:            accountsTypes.Code("v0-lightning-ln-0"),
		Number:          0,
	}))
}

func lightningTopUpSourceAccountCodes(accounts []LightningTopUpSourceAccount) []accountsTypes.Code {
	codes := make([]accountsTypes.Code, 0, len(accounts))
	for _, account := range accounts {
		codes = append(codes, account.AccountConfig.Code)
	}
	return codes
}

func TestLightningTopUpInfoDisconnectedBitBoxReturnsConnectFingerprint(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)
	setTestLightningAccount(t, b, rootFingerprint1)
	b.DeregisterKeystore()

	topUpInfo, err := b.LightningTopUpInfo()
	require.NoError(t, err)
	require.Empty(t, topUpInfo.SourceAccounts)
	require.Nil(t, topUpInfo.DefaultSourceAccountCode)
	require.Equal(t, rootFingerprint1, topUpInfo.AccountToConnectRootFingerprint)
}

func TestLightningTopUpInfoConnectedBitBoxReturnsActiveBTCSourceAccount(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)
	setTestLightningAccount(t, b, rootFingerprint1)

	topUpInfo, err := b.LightningTopUpInfo()
	require.NoError(t, err)
	require.Equal(t, []accountsTypes.Code{"v0-55555555-btc-0"}, lightningTopUpSourceAccountCodes(topUpInfo.SourceAccounts))
	require.NotNil(t, topUpInfo.DefaultSourceAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-0"), *topUpInfo.DefaultSourceAccountCode)
	require.Empty(t, topUpInfo.AccountToConnectRootFingerprint)
	require.True(t, topUpInfo.SourceAccounts[0].KeystoreConnected)
}

func TestLightningTopUpInfoOmitsInactiveBTCAccountWithoutConnectTargetWhenConnected(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks := makeBitBox02Multi()
	ks.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks)
	setTestLightningAccount(t, b, rootFingerprint1)

	btcAccountCode := accountsTypes.Code("v0-55555555-btc-0")
	require.NoError(t, b.SetAccountActive(btcAccountCode, false))

	topUpInfo, err := b.LightningTopUpInfo()
	require.NoError(t, err)
	require.Empty(t, topUpInfo.SourceAccounts)
	require.Nil(t, topUpInfo.DefaultSourceAccountCode)
	require.Empty(t, topUpInfo.AccountToConnectRootFingerprint)
}

func TestLightningTopUpInfoDefaultPrefersLightningRootFingerprint(t *testing.T) {
	b := newBackend(t, testnetDisabled, regtestDisabled)
	defer b.Close()

	ks1 := makeBitBox02Multi()
	ks1.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint1, nil
	}
	b.registerKeystore(ks1)
	setTestLightningAccount(t, b, rootFingerprint1)
	require.NoError(t, b.SetWatchonly(rootFingerprint1, true))
	b.DeregisterKeystore()

	ks2Helper := keystoreHelper2()
	ks2 := makeBitBox02Multi()
	ks2.RootFingerprintFunc = func() ([]byte, error) {
		return rootFingerprint2, nil
	}
	ks2.ExtendedPublicKeyFunc = ks2Helper.ExtendedPublicKey
	ks2.BTCXPubsFunc = ks2Helper.BTCXPubs
	b.registerKeystore(ks2)

	topUpInfo, err := b.LightningTopUpInfo()
	require.NoError(t, err)
	require.Contains(t, lightningTopUpSourceAccountCodes(topUpInfo.SourceAccounts), accountsTypes.Code("v0-55555555-btc-0"))
	require.Contains(t, lightningTopUpSourceAccountCodes(topUpInfo.SourceAccounts), accountsTypes.Code("v0-66666666-btc-0"))
	require.NotNil(t, topUpInfo.DefaultSourceAccountCode)
	require.Equal(t, accountsTypes.Code("v0-55555555-btc-0"), *topUpInfo.DefaultSourceAccountCode)
	require.Empty(t, topUpInfo.AccountToConnectRootFingerprint)
}
