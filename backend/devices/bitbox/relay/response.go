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

package relay

import "github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"

// data models the content of a successful response.
type data struct {
	// ID is the value of the auto-incrementing row ID column of the relay server.
	ID int `json:"id"`

	// Age describes how many seconds passed between a message was pushed and fetched.
	Age int `json:"age"`

	// Payload is the encrypted message which is passed from the mobile to the desktop.
	Payload string `json:"payload"`
}

// response models a response from the relay server.
type response struct {
	// Status is either "ok" or "nok".
	Status string `json:"status"`

	// Data only exists if status is "ok" (and can even then be nil).
	Data []data `json:"data,omitempty"`

	// Error only exists if status is "nok" (and then not nil).
	Error *string `json:"error,omitempty"`
}

// getErrorIfNok returns an error if the status of the response is 'nok'.
func (response *response) getErrorIfNok() error {
	if response.Status == "nok" {
		if response.Error != nil {
			return errp.New(*response.Error)
		}
		return errp.New("Received a 'nok' response from the relay server without an error message.")
	}
	return nil
}
