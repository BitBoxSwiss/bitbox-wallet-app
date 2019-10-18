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
	"fmt"
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
