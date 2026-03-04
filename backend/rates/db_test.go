// SPDX-License-Identifier: Apache-2.0

package rates

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestOpenRatesDBRecoversCorruptFile(t *testing.T) {
	dir := t.TempDir()
	filename := filepath.Join(dir, "rates.db")
	require.NoError(t, os.WriteFile(filename, []byte("not-a-bbolt-db"), 0600))

	log := logrus.New().WithField("test", t.Name())
	db, err := openRatesDB(dir, log)
	require.NoError(t, err)
	require.NotNil(t, db)
	require.NoError(t, db.Close())
}

func TestOpenRatesDBNoRecoveryOnNonCorruptionError(t *testing.T) {
	log := logrus.New().WithField("test", t.Name())
	db, err := openRatesDB(filepath.Join(t.TempDir(), "missing"), log)
	require.Error(t, err)
	require.Nil(t, db)
}
