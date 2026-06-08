// SPDX-License-Identifier: Apache-2.0

package config_test

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/stretchr/testify/assert"
)

func TestMainLocaleFromNative(t *testing.T) {
	locales := []string{"it_IT", "en-US", "fr"}
	results := []string{"it", "en", "fr"}

	for i, locale := range locales {
		assert.Equal(t, results[i], config.MainLocaleFromNative(locale))
	}
}
