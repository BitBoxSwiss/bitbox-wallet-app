// SPDX-License-Identifier: Apache-2.0

package config

import (
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func TestNewConfig(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)

	appJsonBytes, err := os.ReadFile(appConfigFilename)
	require.NoError(t, err)
	expectedAppJsonBytes, err := json.Marshal(NewDefaultAppConfig())
	require.NoError(t, err)
	require.JSONEq(t, string(expectedAppJsonBytes), string(appJsonBytes))

	accountsJsonBytes, err := os.ReadFile(accountsConfigFilename)
	require.NoError(t, err)
	expectedAccountsJsonBytes, err := json.Marshal(newDefaultAccountsConfig())
	require.NoError(t, err)
	require.JSONEq(t, string(expectedAccountsJsonBytes), string(accountsJsonBytes))

	lightningJsonBytes, err := os.ReadFile(lightningConfigFilename)
	require.NoError(t, err)
	expectedLightningJsonBytes, err := json.Marshal(newDefaultLightningConfig())
	require.NoError(t, err)
	require.JSONEq(t, string(expectedLightningJsonBytes), string(lightningJsonBytes))

	// Load existing config.
	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
}

func TestSetAppConfig(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)

	appCfg := cfg.AppConfig()
	require.Equal(t, coin.BtcUnitDefault, appCfg.Backend.BtcUnit)
	appCfg.Backend.BtcUnit = coin.BtcUnitSats
	appCfg.Frontend = map[string]interface{}{"foo": "bar"}
	require.NoError(t, cfg.SetAppConfig(appCfg))

	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
	require.Equal(t, coin.BtcUnitSats, cfg2.AppConfig().Backend.BtcUnit)
	require.Equal(t, map[string]interface{}{"foo": "bar"}, cfg2.AppConfig().Frontend)
}

func TestModifyAccountsConfig(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)

	require.NoError(t, cfg.ModifyAccountsConfig(func(accountsCfg *AccountsConfig) error {
		accountsCfg.Accounts = append(accountsCfg.Accounts, &Account{Used: true})
		return nil
	}))

	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
	require.Equal(t, []*Account{{Used: true}}, cfg2.AccountsConfig().Accounts)

	require.Error(t, cfg.ModifyAccountsConfig(func(accountsCfg *AccountsConfig) error {
		return errors.New("error")
	}))
}

func TestModifyLightningConfig(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)

	require.NoError(t, cfg.ModifyLightningConfig(func(lightningCfg *LightningConfig) error {
		require.Empty(t, lightningCfg.Accounts)
		lightningCfg.Accounts = []*LightningAccountConfig{{
			Mnemonic:        "test",
			Code:            "v0-deadbeef-ln-0",
			Number:          0,
			RootFingerprint: []byte{0xde, 0xad, 0xbe, 0xef},
		}}
		return nil
	}))

	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
	require.Len(t, cfg2.LightningConfig().Accounts, 1)

	require.Error(t, cfg.ModifyLightningConfig(func(lightningCfg *LightningConfig) error {
		lightningCfg.Accounts = nil
		return errors.New("error")
	}))
	require.Len(t, cfg.LightningConfig().Accounts, 1)

	cfg3, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	require.Len(t, cfg3.LightningConfig().Accounts, 1)
}

func TestLightningConfigPersistence(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")

	_, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)

	err = os.WriteFile(lightningConfigFilename, []byte(`{
		"accounts": [{
			"mnemonic": "test",
			"rootFingerprint": "deadbeef",
			"code": "v0-deadbeef-ln-0",
			"num": 0
		}]
	}`), 0644)
	require.NoError(t, err)

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	require.Len(t, cfg.LightningConfig().Accounts, 1)
	require.Equal(t, "v0-deadbeef-ln-0", string(cfg.LightningConfig().Accounts[0].Code))

	cfgCopy := cfg.LightningConfig()
	require.NoError(t, cfg.ModifyLightningConfig(func(lightningCfg *LightningConfig) error {
		*lightningCfg = cfgCopy
		return nil
	}))

	lightningJSON, err := os.ReadFile(lightningConfigFilename)
	require.NoError(t, err)
	require.JSONEq(t, `{
		"accounts": [{
			"mnemonic": "test",
			"rootFingerprint": "deadbeef",
			"code": "v0-deadbeef-ln-0",
			"num": 0
		}]
	}`, string(lightningJSON))
}

// TestMigrationSaved tests that migrations are applied when a config is loaded, and that the
// migrations are persisted.
func TestMigrationsAtLoad(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")
	lightningConfigFilename := test.TstTempFile("lightningConfig")

	// Persist a config that includes data that will be migrated.
	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	appCfg := cfg.AppConfig()
	appCfg.Frontend = map[string]interface{}{
		"userLanguage": "de",
	}
	require.NoError(t, cfg.SetAppConfig(appCfg))
	require.NoError(t, cfg.ModifyAccountsConfig(func(accountsCfg *AccountsConfig) error {
		accountsCfg.Accounts = append(accountsCfg.Accounts,
			&Account{CoinCode: coin.CodeETH, ActiveTokens: []string{"eth-erc20-sai0x89d"}})
		return nil
	}))

	// Loading the conf applies the migrations.
	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	require.Equal(t, "de", cfg2.AppConfig().Backend.UserLanguage)
	require.Equal(t,
		[]*Account{{CoinCode: coin.CodeETH, ActiveTokens: nil}},
		cfg2.AccountsConfig().Accounts)

	// The migrations were persisted.
	cfg3, err := NewConfig(appConfigFilename, accountsConfigFilename, lightningConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg2, cfg3)
}

func TestMigrateElectrumXUpgradesLegacyDefaultServers(t *testing.T) {
	appconf := AppConfig{
		Backend: Backend{
			BTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "btc1.shiftcrypto.io:50001",
						TLS:     true,
						PEMCert: "",
					},
					{
						Server:  "btc2.shiftcrypto.io:50002",
						TLS:     true,
						PEMCert: "",
					},
				},
			},
			LTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "ltc1.shiftcrypto.io:50011",
						TLS:     true,
						PEMCert: "",
					},
					{
						Server:  "ltc2.shiftcrypto.io:50012",
						TLS:     true,
						PEMCert: "",
					},
				},
			},
		},
	}

	migrateElectrumX(&appconf)

	require.Equal(t, defaultBTCElectrumServers, serverAddresses(appconf.Backend.BTC.ElectrumServers))
	require.Equal(t, defaultLTCElectrumServers, serverAddresses(appconf.Backend.LTC.ElectrumServers))
	for _, server := range appconf.Backend.BTC.ElectrumServers {
		require.True(t, server.TLS)
		require.Equal(t, shiftRootCA, server.PEMCert)
	}
	for _, server := range appconf.Backend.LTC.ElectrumServers {
		require.True(t, server.TLS)
		require.Equal(t, shiftRootCA, server.PEMCert)
	}
}

func TestMigrateElectrumXLeavesCustomServersUntouched(t *testing.T) {
	appconf := AppConfig{
		Backend: Backend{
			BTC: btcCoinConfig{
				ElectrumServers: []*ServerInfo{
					{
						Server:  "btc1.shiftcrypto.io:443",
						TLS:     true,
						PEMCert: shiftRootCA,
					},
					{
						Server:  "custom.example.com:50002",
						TLS:     true,
						PEMCert: "custom-cert",
					},
				},
			},
		},
	}

	migrateElectrumX(&appconf)

	require.Equal(t, []string{
		"btc1.shiftcrypto.io:443",
		"custom.example.com:50002",
	}, serverAddresses(appconf.Backend.BTC.ElectrumServers))
}

func serverAddresses(servers []*ServerInfo) []string {
	result := make([]string, 0, len(servers))
	for _, server := range servers {
		result = append(result, server.Server)
	}
	return result
}
