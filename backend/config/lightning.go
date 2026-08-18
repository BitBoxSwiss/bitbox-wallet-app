// SPDX-License-Identifier: Apache-2.0

package config

import (
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/jsonp"
)

// LightningAccountConfig is the configuration of a single Lightning account.
type LightningAccountConfig struct {
	// Seed is the wallet seed generated from the device entropy.
	Seed string `json:"seed"`
	// RootFingerprint is fingerprint of the keystore that generated the entropy.
	RootFingerprint jsonp.HexBytes `json:"rootFingerprint"`
	// Code is the code of the lightning account.
	Code types.Code `json:"code"`
	// Number is the lightning account incremental number.
	Number uint16 `json:"num"`
	// LightningAddressLastChangedAt is the date/time when the lightning address was last changed manually.
	LightningAddressLastChangedAt *time.Time `json:"lightningAddressLastChangedAt,omitempty"`
	// PaymentIntents maps payment fingerprints to backend-owned idempotency state.
	PaymentIntents map[string]LightningPaymentIntent `json:"paymentIntents,omitempty"`
}

// LightningPaymentIntent is a persisted logical outgoing payment.
type LightningPaymentIntent struct {
	IdempotencyKey string `json:"idempotencyKey"`
	Completed      bool   `json:"completed,omitempty"`
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

// LookupLightningPaymentIntent returns a copy of the active account's payment intent.
func (config *Config) LookupLightningPaymentIntent(fingerprint string) (LightningPaymentIntent, bool) {
	defer config.lightningConfigLock.RLock()()
	if len(config.lightningConfig.Accounts) == 0 {
		return LightningPaymentIntent{}, false
	}
	intent, ok := config.lightningConfig.Accounts[0].PaymentIntents[fingerprint]
	return intent, ok
}
