// SPDX-License-Identifier: Apache-2.0

package config

import (
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"
)

// LightningAccountConfig is the configuration of a single Lightning account.
type LightningAccountConfig struct {
	// Mnemonic is the wallet node generated from the device entropy.
	Mnemonic string `json:"mnemonic"`
	// RootFingerprint is fingerprint of the keystore that generated the entropy.
	RootFingerprint jsonp.HexBytes `json:"rootFingerprint"`
	// Code is the code of the lightning account.
	Code types.Code `json:"code"`
	// Number is the lightning account incremental number.
	Number uint16 `json:"num"`
}

// LightningConfig holds information related to the lightning config.
type LightningConfig struct {
	// Accounts is an array of existing lightning accounts configurations.
	Accounts []*LightningAccountConfig `json:"accounts"`
}

// newDefaultAccountsConfig returns the default accounts config.
func newDefaultLightningConfig() LightningConfig {
	return LightningConfig{
		Accounts: []*LightningAccountConfig{},
	}
}
