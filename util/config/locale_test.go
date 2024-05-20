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
