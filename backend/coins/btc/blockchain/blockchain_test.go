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

package blockchain

import (
	"testing"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/stretchr/testify/require"
)

func TestStatus(t *testing.T) {
	history := TxHistory{}
	require.Equal(t, "", history.Status())

	tx1 := &TxInfo{
		Height: 10,
		TXHash: TXHash(chainhash.HashH([]byte("tx1"))),
	}
	tx2 := &TxInfo{
		Height: 12,
		TXHash: TXHash(chainhash.HashH([]byte("tx2"))),
	}

	history = []*TxInfo{tx1}
	require.Equal(t,
		"5ac1b066322843c5cb9160e8079dd759eddf6f1fd60645d6bf54942dcba00d09",
		history.Status())

	history = []*TxInfo{tx1, tx2}
	require.Equal(t,
		"9783fa8a2f1c89652022e0bb435f302ee8b856961dd979ee083435c65384f314",
		history.Status())
}
