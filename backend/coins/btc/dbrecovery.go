// SPDX-License-Identifier: Apache-2.0

package btc

import (
	"errors"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/db/headersdb"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/db/transactionsdb"
	backendutil "github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/sirupsen/logrus"
	bolterrors "go.etcd.io/bbolt/errors"
)

// openHeadersDBWithRecovery opens the headers DB and retries after removing the DB file only for corruption errors.
func openHeadersDBWithRecovery(filename string, log *logrus.Entry) (*headersdb.DB, error) {
	db, err := headersdb.NewDB(filename, log)
	if err == nil {
		return db, nil
	}
	if !headersdb.IsCorruptionError(err) {
		return nil, err
	}
	recovered, recoverErr := backendutil.RemoveCorruptDBFile(filename, err, log, "headers DB")
	if recoverErr != nil || !recovered {
		if recoverErr != nil {
			return nil, recoverErr
		}
		return nil, err
	}
	return headersdb.NewDB(filename, log)
}

func isTransactionsDBCorruptionError(err error) bool {
	return errors.Is(err, bolterrors.ErrInvalid) ||
		errors.Is(err, bolterrors.ErrChecksum) ||
		errors.Is(err, bolterrors.ErrVersionMismatch)
}

// openTransactionsDBWithRecovery opens the transactions DB and retries after quarantining only for corruption errors.
func openTransactionsDBWithRecovery(filename string, log *logrus.Entry) (*transactionsdb.DB, error) {
	db, err := transactionsdb.NewDB(filename)
	if err == nil {
		return db, nil
	}
	if !isTransactionsDBCorruptionError(err) {
		return nil, err
	}
	recovered, recoverErr := backendutil.QuarantineCorruptDBFile(filename, err, log, "transactions DB")
	if recoverErr != nil || !recovered {
		if recoverErr != nil {
			return nil, recoverErr
		}
		return nil, err
	}
	return transactionsdb.NewDB(filename)
}
