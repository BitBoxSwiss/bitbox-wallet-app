// SPDX-License-Identifier: Apache-2.0

package config

import (
	"encoding/json"
	"errors"
	"os"
	"runtime"
	"testing"

	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func TestNewConfig(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename)
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
	requirePrivateFileMode(t, appConfigFilename)
	requirePrivateFileMode(t, accountsConfigFilename)

	// Load existing config.
	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
}

func TestNewConfigRestrictsExistingConfigFiles(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.NoError(t, os.Chmod(appConfigFilename, 0644))
	require.NoError(t, os.Chmod(accountsConfigFilename, 0644))

	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
	requirePrivateFileMode(t, appConfigFilename)
	requirePrivateFileMode(t, accountsConfigFilename)
}

func TestSetAppConfig(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)

	appCfg := cfg.AppConfig()
	require.Equal(t, coin.BtcUnitDefault, appCfg.Backend.BtcUnit)
	appCfg.Backend.BtcUnit = coin.BtcUnitSats
	appCfg.Frontend = map[string]interface{}{"foo": "bar"}
	require.NoError(t, cfg.SetAppConfig(appCfg))

	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
	require.Equal(t, coin.BtcUnitSats, cfg2.AppConfig().Backend.BtcUnit)
	require.Equal(t, map[string]interface{}{"foo": "bar"}, cfg2.AppConfig().Frontend)
}

func TestModifyAccountsConfig(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)

	require.NoError(t, cfg.ModifyAccountsConfig(func(accountsCfg *AccountsConfig) error {
		accountsCfg.Accounts = append(accountsCfg.Accounts, &Account{Used: true})
		return nil
	}))

	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
	require.Equal(t, []*Account{{Used: true}}, cfg2.AccountsSnapshot().Accounts)

	require.Error(t, cfg.ModifyAccountsConfig(func(accountsCfg *AccountsConfig) error {
		accountsCfg.Accounts[0].Used = false
		return errors.New("error")
	}))
	require.True(t, cfg.AccountsSnapshot().Accounts[0].Used)

	cfg.accountsConfigFilename = t.TempDir()
	require.Error(t, cfg.ModifyAccountsConfig(func(accountsCfg *AccountsConfig) error {
		accountsCfg.Accounts[0].Used = false
		return nil
	}))
	require.True(t, cfg.AccountsSnapshot().Accounts[0].Used)
}

func TestAccountsSnapshot(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")

	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)

	watch := true
	receiveScriptType := signing.ScriptTypeP2WPKH
	backupReminderAllowed := true
	code := accountsTypes.Code("account-code")
	require.NoError(t, cfg.ModifyAccountsConfig(func(accountsCfg *AccountsConfig) error {
		accountsCfg.Accounts = append(accountsCfg.Accounts, &Account{
			Code:              code,
			Name:              "Original",
			Watch:             &watch,
			ReceiveScriptType: &receiveScriptType,
			ActiveTokens:      []string{"token"},
		})
		accountsCfg.Keystores = append(accountsCfg.Keystores, &Keystore{
			RootFingerprint:       []byte{1, 2, 3, 4},
			BackupReminderAllowed: &backupReminderAllowed,
		})
		return nil
	}))

	snapshot := cfg.AccountsSnapshot()
	snapshotJSON, err := json.Marshal(snapshot)
	require.NoError(t, err)
	persistedJSON, err := json.Marshal(cfg.AccountsSnapshot())
	require.NoError(t, err)
	require.JSONEq(t, string(persistedJSON), string(snapshotJSON))

	snapshotAccount := snapshot.Lookup(code)
	snapshotAccount.Name = "Snapshot"
	*snapshotAccount.Watch = false
	*snapshotAccount.ReceiveScriptType = signing.ScriptTypeP2TR
	snapshotAccount.ActiveTokens[0] = "snapshot-token"
	snapshot.Keystores[0].RootFingerprint[0] = 9
	*snapshot.Keystores[0].BackupReminderAllowed = false

	persisted := cfg.AccountsSnapshot()
	require.Equal(t, "Original", persisted.Lookup(code).Name)
	require.True(t, *persisted.Lookup(code).Watch)
	require.Equal(t, signing.ScriptTypeP2WPKH, *persisted.Lookup(code).ReceiveScriptType)
	require.Equal(t, []string{"token"}, persisted.Lookup(code).ActiveTokens)
	require.Equal(t, byte(1), persisted.Keystores[0].RootFingerprint[0])
	require.True(t, *persisted.Keystores[0].BackupReminderAllowed)
}

// TestMigrationSaved tests that migrations are applied when a config is loaded, and that the
// migrations are persisted.
func TestMigrationsAtLoad(t *testing.T) {
	appConfigFilename := test.TstTempFile("appConfig")
	accountsConfigFilename := test.TstTempFile("accountsConfig")

	// Persist a config that includes data that will be migrated.
	cfg, err := NewConfig(appConfigFilename, accountsConfigFilename)
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
	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.Equal(t, "de", cfg2.AppConfig().Backend.UserLanguage)
	require.Equal(t,
		[]*Account{{CoinCode: coin.CodeETH, ActiveTokens: nil}},
		cfg2.AccountsSnapshot().Accounts)

	// The migrations were persisted.
	cfg3, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg2, cfg3)
}

func requirePrivateFileMode(t *testing.T, filename string) {
	t.Helper()
	if runtime.GOOS == "windows" {
		return
	}
	info, err := os.Stat(filename)
	require.NoError(t, err)
	require.Equal(t, os.FileMode(0600), info.Mode().Perm())
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
