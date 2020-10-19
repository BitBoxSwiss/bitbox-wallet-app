package rates

import (
	"encoding/binary"
	"math"
	"path/filepath"
	"time"

	bbolt "github.com/coreos/bbolt"
)

func openRatesDB(dir string) (*bbolt.DB, error) {
	opt := &bbolt.Options{Timeout: 5 * time.Second} // network disks may take long
	return bbolt.Open(filepath.Join(dir, "rates.db"), 0600, opt)
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
	// bbolt's readme says it stores the keys in byte-sorted order within a bucket.
	// It doesn't say anything about what order takes place during the reads.
	// However, tests seem to confirm it's a sequential read, in the same order
	// in which the keys are stored. Hope it stays that way.
	// See vendor/github.com/coreos/bbolt/README.md for some more details.
	//
	// Given the above, assume rates is already sorted by timestamp in ascending order.
	return rates, err
}

// dumpHistoryBucket stores rates in a DB bucket identified by the key.
// It assumes rates are already sorted by timestamp in ascending order.
func (updater *RateUpdater) dumpHistoryBucket(key string, rates []exchangeRate) error {
	return updater.historyDB.Update(func(tx *bbolt.Tx) error {
		tx.DeleteBucket([]byte(key)) //nolint:errcheck // don't care: next line will fail anyway
		bucket, err := tx.CreateBucket([]byte(key))
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
