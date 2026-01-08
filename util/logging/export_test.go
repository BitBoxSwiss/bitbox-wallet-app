// SPDX-License-Identifier: Apache-2.0

package logging

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWriteCombinedLog(t *testing.T) {
	tempdir := t.TempDir()

	logfile := filepath.Join(tempdir, "log.txt")
	require.NoError(t, os.WriteFile(logfile, []byte("new\n"), 0600))
	require.NoError(t, os.WriteFile(logfile+".1", []byte("old\n"), 0600))

	var buf bytes.Buffer
	require.NoError(t, WriteCombinedLog(&buf, logfile))
	require.Equal(t, "----- log.txt.1 -----\nold\n\n\n----- log.txt -----\nnew\n", buf.String())
}

func TestWriteCombinedLogNoRotatedFile(t *testing.T) {
	tempdir := t.TempDir()

	logfile := filepath.Join(tempdir, "log.txt")
	require.NoError(t, os.WriteFile(logfile, []byte("new\n"), 0600))

	var buf bytes.Buffer
	require.NoError(t, WriteCombinedLog(&buf, logfile))
	require.Equal(t, "----- log.txt -----\nnew\n", buf.String())
}

func TestWriteCombinedLogNoFiles(t *testing.T) {
	tempdir := t.TempDir()
	logfile := filepath.Join(tempdir, "log.txt")

	var buf bytes.Buffer
	require.Error(t, WriteCombinedLog(&buf, logfile))
}
