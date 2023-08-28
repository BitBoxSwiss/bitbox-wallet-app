// Copyright 2018 Shift Devices AG
// Copyright 2023 Shift Crypto AG
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

package lightning

import (
	"fmt"
	"os"
	"path"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

// ensurePath creates a working directory for the Breez SDK service based on the account identifier.
func ensurePath(account accounts.Interface) (*string, error) {
	if account == nil {
		return nil, errp.New("Account not set")
	}

	accountIdentifier := fmt.Sprintf("account-%s", account.Config().Config.Code)
	workingDir := path.Join(account.Config().DBFolder, accountIdentifier, "lightning")

	if err := os.MkdirAll(workingDir, 0700); err != nil {
		return nil, errp.WithStack(err)
	}

	return &workingDir, nil
}

// ToMsats converts a satoshi amount to millisatoshi.
func ToMsats(sats uint64) uint64 {
	return sats * 1_000
}

// ToSats converts a millisatoshi amount to satoshi.
func ToSats(msats uint64) uint64 {
	return msats / 1_000
}
