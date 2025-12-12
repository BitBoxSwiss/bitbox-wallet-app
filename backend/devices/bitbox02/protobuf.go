// SPDX-License-Identifier: Apache-2.0

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
	coinpkg.CodeRBTC: messages.BTCCoin_RBTC,
}

var btcMsgScriptTypeMap = map[signing.ScriptType]messages.BTCScriptConfig_SimpleType{
	signing.ScriptTypeP2WPKHP2SH: messages.BTCScriptConfig_P2WPKH_P2SH,
	signing.ScriptTypeP2WPKH:     messages.BTCScriptConfig_P2WPKH,
	signing.ScriptTypeP2TR:       messages.BTCScriptConfig_P2TR,
}
