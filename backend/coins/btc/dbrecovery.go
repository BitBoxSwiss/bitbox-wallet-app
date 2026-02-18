// SPDX-License-Identifier: Apache-2.0

package btc

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/db/headersdb"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/db/transactionsdb"
	"github.com/sirupsen/logrus"
)

func quarantineCorruptDBFile(
	filename string,
	openErr error,
	log *logrus.Entry,
	dbName string,
) (bool, error) {
	fileInfo, err := os.Stat(filename)
	if errors.Is(err, os.ErrNotExist) {
		return false, openErr
	}
	if err != nil {
		return false, err
	}
	if fileInfo.IsDir() {
		return false, fmt.Errorf("%s is a directory", filename)
	}

	backupFilename := fmt.Sprintf("%s.corrupt.%d", filename, time.Now().UTC().UnixNano())
	if err := os.Rename(filename, backupFilename); err != nil {
		return false, err
	}
	log.WithError(openErr).
		WithFields(logrus.Fields{"source": filename, "backup": backupFilename}).
		Warnf("%s appears corrupted, moved aside and recreating", dbName)
	return true, nil
}

func openHeadersDBWithRecovery(filename string, log *logrus.Entry) (*headersdb.DB, error) {
	db, err := headersdb.NewDB(filename, log)
	if err == nil {
		return db, nil
	}
	recovered, recoverErr := quarantineCorruptDBFile(filename, err, log, "headers DB")
	if recoverErr != nil || !recovered {
		if recoverErr != nil {
			return nil, recoverErr
		}
		return nil, err
	}
	return headersdb.NewDB(filename, log)
}

func openTransactionsDBWithRecovery(filename string, log *logrus.Entry) (*transactionsdb.DB, error) {
	db, err := transactionsdb.NewDB(filename)
	if err == nil {
		return db, nil
	}
	recovered, recoverErr := quarantineCorruptDBFile(filename, err, log, "transactions DB")
	if recoverErr != nil || !recovered {
		if recoverErr != nil {
			return nil, recoverErr
		}
		return nil, err
	}
	return transactionsdb.NewDB(filename)
}
