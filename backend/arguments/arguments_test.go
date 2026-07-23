// SPDX-License-Identifier: Apache-2.0

package arguments

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestNewArgumentsRestrictsExistingConfigFiles(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("file mode checks are not meaningful on windows")
	}

	mainDirectoryPath := t.TempDir()
	appConfigFilename := filepath.Join(mainDirectoryPath, "config.json")
	accountsConfigFilename := filepath.Join(mainDirectoryPath, "accounts.json")
	lightningConfigFilename := filepath.Join(mainDirectoryPath, "lightning.json")
	require.NoError(t, os.WriteFile(appConfigFilename, []byte("{}"), 0644))
	require.NoError(t, os.WriteFile(accountsConfigFilename, []byte("{}"), 0644))
	require.NoError(t, os.WriteFile(lightningConfigFilename, []byte("{}"), 0644))

	logging.Set(&logging.Configuration{Output: "STDERR", Level: logrus.DebugLevel})
	args := NewArguments(mainDirectoryPath, true, false, false, nil)
	require.Equal(t, appConfigFilename, args.AppConfigFilename())
	require.Equal(t, accountsConfigFilename, args.AccountsConfigFilename())
	require.Equal(t, lightningConfigFilename, args.LightningConfigFilename())
	requirePrivateFileMode(t, appConfigFilename)
	requirePrivateFileMode(t, accountsConfigFilename)
	requirePrivateFileMode(t, lightningConfigFilename)
}

func TestNewArgumentsDoesNotPanicIfConfigFileRestrictionFails(t *testing.T) {
	mainDirectoryPath := t.TempDir()
	require.NoError(t, os.Mkdir(filepath.Join(mainDirectoryPath, "config.json"), 0700))

	logging.Set(&logging.Configuration{Output: "STDERR", Level: logrus.DebugLevel})
	require.NotPanics(t, func() {
		NewArguments(mainDirectoryPath, true, false, false, nil)
	})
}

func requirePrivateFileMode(t *testing.T, filename string) {
	t.Helper()
	info, err := os.Stat(filename)
	require.NoError(t, err)
	require.Equal(t, config.PrivateFileMode, info.Mode().Perm())
}
