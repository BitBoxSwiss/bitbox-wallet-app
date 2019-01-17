// Copyright 2018 Shift Devices AG
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

package backend

import (
	"fmt"

	bbolt "github.com/coreos/bbolt"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

const (
	bucketUnnotifiedKey = "unnotified"
	bucketSeenKey       = "seen"
)

// Notifier implements accounts.Notifier, storing the data of all accounts in a bbolt db.
type Notifier struct {
	db *bbolt.DB
}

// NewNotifier returns a new Notifier.
func NewNotifier(dbFilename string) (*Notifier, error) {
	db, err := bbolt.Open(dbFilename, 0600, nil)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return &Notifier{db: db}, nil
}

type notifierForAccount struct {
	db          *bbolt.DB
	accountCode string
}

// ForAccount returns a Notifier for a specific account.
func (notifier *Notifier) ForAccount(accountCode string) accounts.Notifier {
	return &notifierForAccount{db: notifier.db, accountCode: accountCode}
}

func (notifier *notifierForAccount) write(
	f func(bucketUnnotified, bucketSeen *bbolt.Bucket) error) error {
	tx, err := notifier.db.Begin(true)
	if err != nil {
		return errp.WithStack(err)
	}
	defer func() { _ = tx.Rollback() }()
	bucketAccount, err := tx.CreateBucketIfNotExists([]byte(fmt.Sprintf("account-%s", notifier.accountCode)))
	if err != nil {
		return errp.WithStack(err)
	}
	bucketUnnotified, err := bucketAccount.CreateBucketIfNotExists([]byte(bucketUnnotifiedKey))
	if err != nil {
		return errp.WithStack(err)
	}
	bucketSeen, err := bucketAccount.CreateBucketIfNotExists([]byte(bucketSeenKey))
	if err != nil {
		return errp.WithStack(err)
	}
	if err := f(bucketUnnotified, bucketSeen); err != nil {
		return err
	}
	return errp.WithStack(tx.Commit())
}

func (notifier *notifierForAccount) read(
	f func(bucketUnnotified, bucketSeen *bbolt.Bucket)) error {
	tx, err := notifier.db.Begin(false)
	if err != nil {
		return errp.WithStack(err)
	}
	defer func() { _ = tx.Rollback() }()
	bucketAccount := tx.Bucket([]byte(fmt.Sprintf("account-%s", notifier.accountCode)))
	if bucketAccount == nil {
		f(nil, nil)
	} else {
		bucketUnnotified := bucketAccount.Bucket([]byte(bucketUnnotifiedKey))
		bucketSeen := bucketAccount.Bucket([]byte(bucketSeenKey))
		f(bucketUnnotified, bucketSeen)
	}
	return nil
}

// Put implements accounts.Notifier,
func (notifier *notifierForAccount) Put(id []byte) error {
	return notifier.write(func(bucketUnnotified, bucketSeen *bbolt.Bucket) error {
		if bucketSeen.Get(id) != nil {
			return nil
		}
		return errp.WithStack(bucketUnnotified.Put(id, nil))
	})
}

// Delete implements accounts.Notifier.
func (notifier *notifierForAccount) Delete(id []byte) error {
	return notifier.write(func(bucketUnnotified, bucketSeen *bbolt.Bucket) error {
		if err := bucketUnnotified.Delete(id); err != nil {
			return errp.WithStack(err)
		}
		return errp.WithStack(bucketSeen.Delete(id))
	})
}

func count(bucket *bbolt.Bucket) int {
	if bucket == nil {
		return 0
	}
	result := 0
	cursor := bucket.Cursor()
	for key, _ := cursor.First(); key != nil; key, _ = cursor.Next() {
		result++
	}
	return result
}

// UnnotifiedCount implements accounts.Notifier.
func (notifier *notifierForAccount) UnnotifiedCount() (int, error) {
	unnotified := 0
	err := notifier.read(func(bucketUnnotified, bucketSeen *bbolt.Bucket) {
		unnotified = count(bucketUnnotified)
	})
	if err != nil {
		return 0, err
	}

	return unnotified, nil
}

// MarkAllNotified implements accounts.Notifier.
func (notifier *notifierForAccount) MarkAllNotified() error {
	return notifier.write(func(bucketUnnotified, bucketSeen *bbolt.Bucket) error {
		cursor := bucketUnnotified.Cursor()
		for id, _ := cursor.First(); id != nil; id, _ = cursor.Next() {
			if err := bucketUnnotified.Delete(id); err != nil {
				return errp.WithStack(err)
			}
			if err := bucketSeen.Put(id, nil); err != nil {
				return errp.WithStack(err)
			}
		}
		return nil
	})
}
