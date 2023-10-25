// Copyright 2023 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

import (
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
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
	expectedAccountsJsonBytes, err := json.Marshal(newDefaultAccountsonfig())
	require.NoError(t, err)
	require.JSONEq(t, string(expectedAccountsJsonBytes), string(accountsJsonBytes))

	// Load existing config.
	cfg2, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg, cfg2)
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
	require.Equal(t, []*Account{{Used: true}}, cfg2.AccountsConfig().Accounts)

	require.Error(t, cfg.ModifyAccountsConfig(func(accountsCfg *AccountsConfig) error {
		return errors.New("error")
	}))
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
		cfg2.AccountsConfig().Accounts)

	// The migrations were persisted.
	cfg3, err := NewConfig(appConfigFilename, accountsConfigFilename)
	require.NoError(t, err)
	require.Equal(t, cfg2, cfg3)
}
