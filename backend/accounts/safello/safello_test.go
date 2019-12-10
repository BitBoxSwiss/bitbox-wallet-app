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

package safello_test

import (
	"encoding/json"
	"io/ioutil"
	"testing"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts/safello"
	"github.com/digitalbitbox/bitbox-wallet-app/util/test"
	"github.com/stretchr/testify/require"
)

func TestStoreCallbackJSONMessage(t *testing.T) {
	filename := test.TstTempFile("safello")

	require.Error(t, safello.StoreCallbackJSONMessage(filename, nil))
	require.Error(t, safello.StoreCallbackJSONMessage(filename, map[string]json.RawMessage{"key": json.RawMessage(`"value"`)}))

	msg1 := map[string]json.RawMessage{
		"type": json.RawMessage(`"ORDER_DONE"`),
		"key1": json.RawMessage(`"value1"`),
		"key2": json.RawMessage(`"value2"`),
	}
	msg2 := map[string]json.RawMessage{
		"type": json.RawMessage(`"ORDER_DONE"`),
	}
	msg3 := map[string]json.RawMessage{
		"type": json.RawMessage(`"TRANSACTION_ISSUED"`),
		"foo":  json.RawMessage(`"bar"`),
	}
	require.NoError(t, safello.StoreCallbackJSONMessage(filename, msg1))
	require.NoError(t, safello.StoreCallbackJSONMessage(filename, msg2))
	require.NoError(t, safello.StoreCallbackJSONMessage(filename, msg3))

	result, err := ioutil.ReadFile(filename) // #nosec G304
	require.NoError(t, err)
	require.JSONEq(t,
		`[{"key1":"value1","key2":"value2","type":"ORDER_DONE"},{"type":"ORDER_DONE"},{"foo":"bar","type":"TRANSACTION_ISSUED"}]`,
		string(result),
	)
}
