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

package observable

import "github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"

// Event is passed to the listeners of an observable type.
type Event struct {
	// Subject identifies what changed.
	// By convention, it corresponds to the corresponding GET endpoint of the REST API.
	Subject string `json:"subject"`

	// Action describes how the change has to be applied.
	Action action.Action `json:"action"`

	// Object contains the data that changed.
	Object interface{} `json:"object"`
}
