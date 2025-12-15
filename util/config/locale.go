// SPDX-License-Identifier: Apache-2.0

package config

import (
	"strings"
)

// MainLocaleFromNative takes as input the nativeLocale as given by
// backend.Environment().NativeLocale() and returns the language as
// in ISO 639-1.
func MainLocaleFromNative(nativeLocale string) string {
	nativeLocale = strings.ReplaceAll(nativeLocale, "_", "-")
	return strings.Split(nativeLocale, "-")[0]
}
