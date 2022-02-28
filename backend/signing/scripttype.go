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

package signing

// ScriptType indicates which type of output should be produced in case of singlesig.
type ScriptType string

const (
	// ScriptTypeP2PKH is a PayToPubKeyHash output.
	ScriptTypeP2PKH ScriptType = "p2pkh"

	// ScriptTypeP2WPKHP2SH is a segwit v0 PayToPubKeyHash output wrapped in p2sh.
	ScriptTypeP2WPKHP2SH ScriptType = "p2wpkh-p2sh"

	// ScriptTypeP2WPKH is a segwit v0 PayToPubKeyHash output.
	ScriptTypeP2WPKH ScriptType = "p2wpkh"

	// ScriptTypeP2TR is a BIP-86 segwit v1 PayToTaproot output.
	ScriptTypeP2TR ScriptType = "p2tr"
)
