// Copyright 2018 Shift Devices AG
// Copyright 2020 Shift Crypto AG
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

package bitbox02

import (
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
)

// conversions from types used by the wallet to types defined in the protobuf messages.

var btcMsgCoinMap = map[coinpkg.Code]messages.BTCCoin{
	coinpkg.CodeBTC:  messages.BTCCoin_BTC,
	coinpkg.CodeTBTC: messages.BTCCoin_TBTC,
	coinpkg.CodeLTC:  messages.BTCCoin_LTC,
	coinpkg.CodeTLTC: messages.BTCCoin_TLTC,
}

var btcMsgScriptTypeMap = map[signing.ScriptType]messages.BTCScriptConfig_SimpleType{
	signing.ScriptTypeP2WPKHP2SH: messages.BTCScriptConfig_P2WPKH_P2SH,
	signing.ScriptTypeP2WPKH:     messages.BTCScriptConfig_P2WPKH,
	signing.ScriptTypeP2TR:       messages.BTCScriptConfig_P2TR,
}
