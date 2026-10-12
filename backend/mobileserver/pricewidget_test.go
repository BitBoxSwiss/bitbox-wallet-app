// SPDX-License-Identifier: Apache-2.0

package mobileserver

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWidgetCanInitializeBeforeServer(t *testing.T) {
	// Each cold-start assertion needs fresh process globals, including with go test -count.
	if os.Getenv("BITBOX_TEST_WIDGET_INIT") == "" {
		cmd := exec.CommandContext(t.Context(), os.Args[0], "-test.run=^TestWidgetCanInitializeBeforeServer$") // #nosec G204
		cmd.Env = append(os.Environ(), "BITBOX_TEST_WIDGET_INIT=1")
		output, err := cmd.CombinedOutput()
		require.NoError(t, err, "%s", output)
		return
	}
	dir := t.TempDir()
	state, err := PriceWidgetState(dir, 0, false, false)
	require.NoError(t, err)
	assert.Contains(t, state, `"coinCode":"btc"`)
	assert.Equal(t, dir, config.AppDir())
	info, err := os.Stat(filepath.Join(dir, "log.txt"))
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0600), info.Mode().Perm())
	// Serve uses the same initializer when the user opens the app after a widget refresh.
	assert.NotPanics(t, func() { initialize(dir) })
}
