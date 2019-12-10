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

package safello

import (
	"encoding/json"
	"fmt"
	"io/ioutil"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// Buy holds the infos needed to load the Safello Buy widget.
type Buy struct {
	URL       string `json:"url"`
	AddressID string `json:"addressID"`
	Address   string `json:"address"`
}

// NewBuy creates a Buy instance.
func NewBuy(testnet bool, receiveAddressID, receiveAddress string) *Buy {
	const shiftAppID = "6302f999-1f53-4428-871c-7538a1007d8c"
	appID := shiftAppID
	country := ""
	host := "app.safello.com"
	if testnet {
		// Predefined values for the Safello test sandbox.
		appID = "1234-5678"
		country = "no"
		host = "app.s4f3.io"
	}
	return &Buy{
		URL: fmt.Sprintf("https://%s/sdk/quickbuy.html?appId=%s&country=%s&tab=buy&border=false&source=Shift+Cryptosecurity+AG&crypto=btc&address=%s",
			host,
			appID,
			country,
			receiveAddress,
		),
		AddressID: receiveAddressID,
		Address:   receiveAddress,
	}
}

// StoreCallbackJSONMessage  a raw safello JSON object as sent by the Safello widget.
// It is appended at the end of an array of Safello messages.
// file structure: [sallelo object, sallelo object, ....].
// The directory the filename is in must exist beforehand.
// The message must contain a "type" key with a value of either `"ORDER_DONE"` or `"TRANSACTION_ISSUED"`.
func StoreCallbackJSONMessage(filename string, message map[string]json.RawMessage) error {
	val, ok := message["type"]
	if !ok || !(string(val) == `"ORDER_DONE"` || string(val) == `"TRANSACTION_ISSUED"`) {
		return errp.New("message needs to contain a valid type entry")
	}
	messages := []map[string]json.RawMessage{}
	jsonBytes, err := ioutil.ReadFile(filename) // #nosec G304
	if err == nil {
		if err := json.Unmarshal(jsonBytes, &messages); err != nil {
			return errp.WithStack(err)
		}
	}
	messages = append(messages, message)
	writeJSONBytes, err := json.Marshal(messages)
	if err != nil {
		return errp.WithStack(err)
	}
	return ioutil.WriteFile(filename, writeJSONBytes, 0700)
}
