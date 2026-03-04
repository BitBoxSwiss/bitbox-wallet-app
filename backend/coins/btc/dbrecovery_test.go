// SPDX-License-Identifier: Apache-2.0

package btc

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestOpenHeadersDBWithRecovery(t *testing.T) {
	dir := t.TempDir()
	filename := filepath.Join(dir, "headers-btc.bin")
	require.NoError(t, os.WriteFile(filename, []byte{1}, 0600))

	log := logrus.New().WithField("test", t.Name())
	db, err := openHeadersDBWithRecovery(filename, log)
	require.NoError(t, err)
	require.NotNil(t, db)
	require.NoError(t, db.Close())

	backups, err := filepath.Glob(filename + ".corrupt.*")
	require.NoError(t, err)
	require.Len(t, backups, 0)
	fileInfo, err := os.Stat(filename)
	require.NoError(t, err)
	require.EqualValues(t, 0, fileInfo.Size())
}

func TestOpenHeadersDBWithRecoveryNoRecoveryOnNonCorruptionError(t *testing.T) {
	dir := t.TempDir()

	log := logrus.New().WithField("test", t.Name())
	db, err := openHeadersDBWithRecovery(dir, log)
	require.Error(t, err)
	require.Nil(t, db)
}

func TestOpenTransactionsDBWithRecovery(t *testing.T) {
	dir := t.TempDir()
	filename := filepath.Join(dir, "account-test.db")
	require.NoError(t, os.WriteFile(filename, []byte("not-a-bbolt-db"), 0600))

	log := logrus.New().WithField("test", t.Name())
	db, err := openTransactionsDBWithRecovery(filename, log)
	require.NoError(t, err)
	require.NotNil(t, db)
	require.NoError(t, db.Close())

	backups, err := filepath.Glob(filename + ".corrupt.*")
	require.NoError(t, err)
	require.Len(t, backups, 1)
}

func TestOpenTransactionsDBWithRecoveryNoRecoveryOnNonCorruptionError(t *testing.T) {
	dir := t.TempDir()

	log := logrus.New().WithField("test", t.Name())
	db, err := openTransactionsDBWithRecovery(dir, log)
	require.Error(t, err)
	require.Nil(t, db)

	var pathErr *os.PathError
	require.True(t, errors.As(err, &pathErr))
}
