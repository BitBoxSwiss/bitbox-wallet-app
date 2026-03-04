// SPDX-License-Identifier: Apache-2.0

package rates

import (
	"encoding/binary"
	"errors"
	"math"
	"path/filepath"
	"time"

	backendutil "github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/sirupsen/logrus"
	"go.etcd.io/bbolt"
	bolterrors "go.etcd.io/bbolt/errors"
)

func isRatesDBCorruptionError(err error) bool {
	return errors.Is(err, bolterrors.ErrInvalid) ||
		errors.Is(err, bolterrors.ErrChecksum) ||
		errors.Is(err, bolterrors.ErrVersionMismatch)
}

func openRatesDB(dir string, log *logrus.Entry) (*bbolt.DB, error) {
	filename := filepath.Join(dir, "rates.db")
	opt := &bbolt.Options{Timeout: 5 * time.Second} // network disks may take long
	db, err := bbolt.Open(filename, 0600, opt)
	if err == nil {
		return db, nil
	}
	if !isRatesDBCorruptionError(err) {
		return nil, err
	}
	recovered, recoverErr := backendutil.RemoveCorruptDBFile(filename, err, log, "rates DB")
	if recoverErr != nil || !recovered {
		if recoverErr != nil {
			return nil, recoverErr
		}
		return nil, err
	}
	return bbolt.Open(filename, 0600, opt)
}

// loadHistoryBucket loads data from an updater.historyDB bucket identified by the key.
// The returned value is sorted by timestamp in ascending order.
func (updater *RateUpdater) loadHistoryBucket(key string) ([]exchangeRate, error) {
	var rates []exchangeRate
	err := updater.historyDB.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte(key))
		if bucket == nil {
			return nil // no history exists for this key
		}
		// The func is called with k items in already byte-sorted order.
		return bucket.ForEach(func(k, v []byte) error {
			timestamp := binary.BigEndian.Uint64(k)
			value := math.Float64frombits(binary.BigEndian.Uint64(v))
			rates = append(rates, exchangeRate{
				value:     value,
				timestamp: time.Unix(int64(timestamp), 0),
			})
			return nil
		})
	})
	return rates, err
}

// dumpHistoryBucket stores rates in a DB bucket identified by the key.
// It assumes rates are already sorted by timestamp in ascending order.
func (updater *RateUpdater) dumpHistoryBucket(key string, rates []exchangeRate) error {
	return updater.historyDB.Update(func(tx *bbolt.Tx) error {
		bucket, err := tx.CreateBucketIfNotExists([]byte(key))
		if err != nil {
			return err
		}
		for _, rate := range rates {
			var tsbytes [8]byte
			binary.BigEndian.PutUint64(tsbytes[:], uint64(rate.timestamp.Unix()))
			var vbytes [8]byte
			binary.BigEndian.PutUint64(vbytes[:], math.Float64bits(rate.value))
			if err := bucket.Put(tsbytes[:], vbytes[:]); err != nil {
				return err
			}
		}
		return nil
	})
}
