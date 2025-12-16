// SPDX-License-Identifier: Apache-2.0

package rates

import (
	"bytes"
	"encoding/binary"
	"encoding/gob"
	"encoding/json"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.etcd.io/bbolt"
)

// These benchmarks are independent of the actual rates package code.
// They are designed to evaluate performance of various ways to write
// and read data using bbolt DB.
//
// The benchmarks aren't run during regular testing.
// To execute them manually, use the following:
//
//     go test -bench=. -test.run=Benchmark

func BenchmarkBoltDump(b *testing.B) {
	b.Run("individual", func(b *testing.B) {
		dbpath := test.TstTempFile("BenchmarkDumpHistoryIndividual")
		db, err := bbolt.Open(dbpath, 0644, nil)
		require.NoError(b, err, "bbolt.Open")
		data := makeData(5000)

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			err := dumpIndividual(db, "individual", data)
			require.NoError(b, err, "dumpIndividual")
		}
	})

	b.Run("json", func(b *testing.B) {
		dbpath := test.TstTempFile("BenchmarkDumpHistoryJSON")
		db, err := bbolt.Open(dbpath, 0644, nil)
		require.NoError(b, err, "bbolt.Open")
		data := makeData(5000)

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			err := dumpJSON(db, "json", data)
			require.NoError(b, err, "dumpJSON")
		}
	})

	b.Run("gob", func(b *testing.B) {
		dbpath := test.TstTempFile("BenchmarkDumpHistoryGob")
		db, err := bbolt.Open(dbpath, 0644, nil)
		require.NoError(b, err, "bbolt.Open")
		data := makeData(5000)

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			err := dumpGob(db, "gob", data)
			require.NoError(b, err, "dumpGob")
		}
	})
}

func BenchmarkBoltLoad(b *testing.B) {
	b.Run("individual", func(b *testing.B) {
		const bucketName = "individual"
		db, err := bbolt.Open(test.TstTempFile("BenchmarkLoadHistoryIndividual"), 0644, nil)
		require.NoError(b, err, "bbolt.Open")
		require.NoError(b, dumpIndividual(db, bucketName, makeData(5000)))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			rates, err := loadIndividual(db, bucketName)
			require.NoError(b, err, "loadIndividual")
			assert.Len(b, rates, 5000, "len(rates)")
		}
	})

	b.Run("json", func(b *testing.B) {
		const bucketName = "json"
		db, err := bbolt.Open(test.TstTempFile("BenchmarkLoadHistoryJSON"), 0644, nil)
		require.NoError(b, err, "bbolt.Open")
		require.NoError(b, dumpJSON(db, bucketName, makeData(5000)))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			rates, err := loadJSON(db, bucketName)
			require.NoError(b, err, "loadJSON")
			assert.Len(b, rates, 5000, "len(rates)")
		}
	})

	b.Run("gob", func(b *testing.B) {
		const bucketName = "gob"
		db, err := bbolt.Open(test.TstTempFile("BenchmarkLoadHistoryGob"), 0644, nil)
		require.NoError(b, err, "bbolt.Open")
		require.NoError(b, dumpGob(db, bucketName, makeData(5000)))

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			rates, err := loadGob(db, bucketName)
			require.NoError(b, err, "loadGob")
			assert.Len(b, rates, 5000, "len(rates)")
		}
	})
}

type benchExchangeRate struct {
	Value     float64
	Timestamp time.Time
}

//nolint:unparam
func makeData(n int) []benchExchangeRate {
	var data []benchExchangeRate
	for i := 0; i < n; i++ {
		data = append(data, benchExchangeRate{
			Value:     float64(i),
			Timestamp: time.Unix(int64(i), 0),
		})
	}
	return data
}

func dumpIndividual(db *bbolt.DB, bucketName string, data []benchExchangeRate) error {
	return db.Update(func(tx *bbolt.Tx) error {
		tx.DeleteBucket([]byte(bucketName))
		bucket, err := tx.CreateBucket([]byte(bucketName))
		if err != nil {
			return err
		}
		for _, rate := range data {
			var tsbytes [8]byte
			binary.BigEndian.PutUint64(tsbytes[:], uint64(rate.Timestamp.Unix()))
			var vbytes [8]byte
			binary.BigEndian.PutUint64(vbytes[:], math.Float64bits(rate.Value))
			if err := bucket.Put(tsbytes[:], vbytes[:]); err != nil {
				return err
			}
		}
		return nil
	})
}

func loadIndividual(db *bbolt.DB, bucketName string) ([]benchExchangeRate, error) {
	var rates []benchExchangeRate
	err := db.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte(bucketName))
		if bucket == nil {
			return errors.New("no such bucket")
		}
		return bucket.ForEach(func(k, v []byte) error {
			timestamp := binary.BigEndian.Uint64(k)
			value := math.Float64frombits(binary.BigEndian.Uint64(v))
			rates = append(rates, benchExchangeRate{
				Value:     value,
				Timestamp: time.Unix(int64(timestamp), 0),
			})
			return nil
		})
	})
	return rates, err
}

func dumpJSON(db *bbolt.DB, bucketName string, data []benchExchangeRate) error {
	return db.Update(func(tx *bbolt.Tx) error {
		tx.DeleteBucket([]byte(bucketName))
		bucket, err := tx.CreateBucket([]byte(bucketName))
		if err != nil {
			return err
		}
		b, err := json.Marshal(data)
		if err != nil {
			return err
		}
		return bucket.Put([]byte("alljson"), b)
	})
}

func loadJSON(db *bbolt.DB, bucketName string) ([]benchExchangeRate, error) {
	var rates []benchExchangeRate
	err := db.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte(bucketName))
		if bucket == nil {
			return errors.New("no such bucket")
		}
		b := bucket.Get([]byte("alljson"))
		return json.Unmarshal(b, &rates)
	})
	return rates, err
}

func dumpGob(db *bbolt.DB, bucketName string, data []benchExchangeRate) error {
	return db.Update(func(tx *bbolt.Tx) error {
		tx.DeleteBucket([]byte(bucketName))
		bucket, err := tx.CreateBucket([]byte(bucketName))
		if err != nil {
			return err
		}
		var buf bytes.Buffer
		if err := gob.NewEncoder(&buf).Encode(data); err != nil {
			return err
		}
		return bucket.Put([]byte("allgob"), buf.Bytes())
	})
}

func loadGob(db *bbolt.DB, bucketName string) ([]benchExchangeRate, error) {
	var rates []benchExchangeRate
	err := db.View(func(tx *bbolt.Tx) error {
		bucket := tx.Bucket([]byte(bucketName))
		if bucket == nil {
			return errors.New("no such bucket")
		}
		b := bucket.Get([]byte("allgob"))
		return gob.NewDecoder(bytes.NewReader(b)).Decode(&rates)
	})
	return rates, err
}
