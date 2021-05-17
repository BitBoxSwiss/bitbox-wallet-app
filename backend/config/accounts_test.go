// Copyright 2021 Shift Crypto AG
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
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/stretchr/testify/require"
)

func TestByCode(t *testing.T) {
	cfg := AccountsConfig{
		Accounts: []Account{
			{Code: "a"},
			{Code: "b"},
		},
	}
	acct := cfg.Lookup("a")
	require.NotNil(t, acct)
	require.Equal(t, "a", acct.Code)

	acct = cfg.Lookup("b")
	require.NotNil(t, acct)
	require.Equal(t, "b", acct.Code)

	require.Nil(t, cfg.Lookup("c"))

	acct = cfg.Lookup("a")
	require.NotNil(t, acct)
	acct.Name = "foo"
	require.Equal(t, "foo", cfg.Accounts[0].Name)
}

func TestSetTokenActive(t *testing.T) {
	// not an ETH account.
	require.Error(t, (&Account{CoinCode: coin.CodeTETH}).SetTokenActive("TOKEN", true))

	acct := &Account{
		CoinCode: coin.CodeETH,
	}
	require.NoError(t, acct.SetTokenActive("TOKEN-1", true))
	require.Equal(t, []string{"TOKEN-1"}, acct.ActiveTokens)
	require.NoError(t, acct.SetTokenActive("TOKEN-2", true))
	require.Equal(t, []string{"TOKEN-1", "TOKEN-2"}, acct.ActiveTokens)

	require.NoError(t, acct.SetTokenActive("TOKEN-1", false))
	require.Equal(t, []string{"TOKEN-2"}, acct.ActiveTokens)
}
