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

package types

import (
	"encoding/json"
	"errors"
)

// JSONRPC is the JSON RPC version we support.
const JSONRPC = "2.0"

// Request is a JSON RPC request.
type Request struct {
	ID     int           `json:"id"`
	Method string        `json:"method"`
	Params []interface{} `json:"params"`
}

// Response is a catch-all JSON RPC response.
// A notification contains:
// - jsonrpc
// - method
// - params
// A method call response contains:
// - jsonrpc
// - id
// - result
// - (error)
type Response struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      *int             `json:"id"`
	Error   *json.RawMessage `json:"error"`
	Result  json.RawMessage  `json:"result"`
	Method  *string          `json:"method"`
	Params  json.RawMessage  `json:"params"`
}

// ParseError checks if the JSON RPC response contains an error and extracts its message.
func (r *Response) ParseError() error {
	if r.Error == nil {
		return nil
	}
	errStruct := struct {
		Message string `json:"message"`
	}{}
	if err := json.Unmarshal(*r.Error, &errStruct); err == nil {
		return errors.New(errStruct.Message)
	}
	var errStr string
	if err := json.Unmarshal(*r.Error, &errStr); err == nil {
		return errors.New(errStr)
	}

	return errors.New(string(*r.Error))
}
