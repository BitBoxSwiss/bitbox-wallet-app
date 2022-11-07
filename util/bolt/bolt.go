// Copyright 2022 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bolt

import (
	"os"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/sirupsen/logrus"
	"go.etcd.io/bbolt"
)

func checkCorruption(db *bbolt.DB) (err error) {
	return db.View(func(tx *bbolt.Tx) error {
		for err := range tx.Check() {
			return err
		}
		return nil
	})
}

// Open opens or creates a bbolt database. The database is checked for corruption. If any corruption
// is detected, the database is deleted and recreated. Use this only for databases that can be
// discarded (caches, etc).
//
// The corruption check can't cover everything and only checks some basics. Bitflips could still
// corrupt the DB semantically in ways that can't be detected at this level.
// There are also corruptions that lead to a segfaults (hard crash) due to a bug in bbolt:
// https://github.com/etcd-io/bbolt/issues/105#issuecomment-1308502456
func Open(filename string, log *logrus.Entry) (*bbolt.DB, error) {
	opt := &bbolt.Options{Timeout: 5 * time.Second} // network disks may take long
	db, err := bbolt.Open(filename, 0600, opt)
	if err != nil {
		return nil, err
	}
	if err := checkCorruption(db); err != nil {
		_ = db.Close()
		log.Errorf("Database %s is corrupted. Deleting...", filename)
		if err := os.Remove(filename); err != nil {
			return nil, errp.Wrapf(err, "database %s corrupted and cannot be deleted", filename)
		}
		log.Errorf("Corrupted database %s deleted. Attempting to recreate...", filename)
		db, err := bbolt.Open(filename, 0600, opt)
		if err != nil {
			return nil, err
		}
		if err := checkCorruption(db); err != nil {
			log.Errorf("Corrupted database %s recreated, but still corrupted: %v.", filename, err)
			return nil, errp.Wrapf(err, "database %s corrupted", filename)
		}
		log.Errorf("Corrupted database %s successfully recreated.", filename)
		return db, nil
	}
	return db, nil
}
