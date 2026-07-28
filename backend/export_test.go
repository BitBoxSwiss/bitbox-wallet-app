// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"os"
	"path/filepath"
	"testing"

	utilconfig "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

type fileExportEnvironment struct {
	environment
	filename string
}

func (e fileExportEnvironment) GetSaveFilename(string) string {
	return e.filename
}

func TestExportNotesRestrictsFilePermissions(t *testing.T) {
	filename := filepath.Join(t.TempDir(), "notes.jsonl")
	require.NoError(t, os.WriteFile(filename, nil, 0644))
	require.NoError(t, os.Chmod(filename, 0644))

	backend := &Backend{
		environment: fileExportEnvironment{filename: filename},
		log:         logrus.NewEntry(logrus.New()),
	}
	require.NoError(t, backend.ExportNotes())

	info, err := os.Stat(filename)
	require.NoError(t, err)
	require.Equal(t, utilconfig.PrivateFileMode, info.Mode().Perm())
}

func TestExportLogsRestrictsFilePermissions(t *testing.T) {
	filename := filepath.Join(t.TempDir(), "log.txt")
	require.NoError(t, os.WriteFile(filename, nil, 0644))
	require.NoError(t, os.Chmod(filename, 0644))

	backend := &Backend{
		environment: fileExportEnvironment{filename: filename},
		log:         logrus.NewEntry(logrus.New()),
	}
	// The source log may not exist in a unit test, but the export file is opened and restricted
	// before it is read.
	_ = backend.ExportLogs()

	info, err := os.Stat(filename)
	require.NoError(t, err)
	require.Equal(t, utilconfig.PrivateFileMode, info.Mode().Perm())
}
