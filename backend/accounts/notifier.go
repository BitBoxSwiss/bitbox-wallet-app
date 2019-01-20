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

package accounts

// Notifier juggles transaction IDs for the purpose of notifications and unread counts.
//go:generate mockery -name Notifier
type Notifier interface {
	// Put adds the id to the 'unnotified' set, unless it is already in the 'seen' set.
	Put(id []byte) error
	// Delete removes the id from all sets.
	Delete(id []byte) error
	// UnnotifiedCount returns the number ids in the 'unnotified' set.
	UnnotifiedCount() (int, error)
	// MarkAllNotified moves all ids from the 'unnotified' set to the 'seen' set.
	MarkAllNotified() error
}
