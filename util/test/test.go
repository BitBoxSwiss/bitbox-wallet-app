// SPDX-License-Identifier: Apache-2.0

package test

import (
	"encoding/json"
	"io"
	"os"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/sirupsen/logrus"
)

// TstTempFile gets the filename for creating a temporary file.
func TstTempFile(name string) string {
	f, err := os.CreateTemp("", name)
	if err != nil {
		panic(err)
	}
	if err := f.Close(); err != nil {
		panic(err)
	}
	if err := os.Remove(f.Name()); err != nil {
		panic(err)
	}
	return f.Name()
}

// TstTempDir creates a temporary dir and returns its path.
func TstTempDir(name string) string {
	f, err := os.MkdirTemp("", name)
	if err != nil {
		panic(err)
	}
	return f
}

// TstSetupLogging sets up the global logger to log to stderr during tests.
// Should be run inside of `TestMain(m *testing.M) {}`.
func TstSetupLogging() {
	logging.Set(&logging.Configuration{Output: "STDERR", Level: logrus.DebugLevel})
}

// DecodeHandlerResponse parses a handler response into v.
// It fails the test with t.Fatal if the response is in invalid format.
func DecodeHandlerResponse(t *testing.T, v interface{}, r io.Reader) {
	t.Helper()
	if err := json.NewDecoder(r).Decode(v); err != nil {
		t.Fatalf("DecodeHandlerResponse: %v", err)
	}
}

// TstMustXKey parses an xpub/xprv and panics on error.
func TstMustXKey(key string) *hdkeychain.ExtendedKey {
	xkey, err := hdkeychain.NewKeyFromString(key)
	if err != nil {
		panic(err)
	}
	return xkey
}
