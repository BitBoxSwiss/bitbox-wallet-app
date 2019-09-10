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

package bitbox02

import (
	"github.com/btcsuite/btcd/txscript"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/devices/bitbox02/messages"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
)

// conversions from types used by the wallet to types defined in the protobuf messages.

var btcMsgCoinMap = map[string]messages.BTCCoin{
	"btc":  messages.BTCCoin_BTC,
	"tbtc": messages.BTCCoin_TBTC,
	"ltc":  messages.BTCCoin_LTC,
	"tltc": messages.BTCCoin_TLTC,
}

var btcMsgScriptTypeMap = map[signing.ScriptType]messages.BTCScriptType{
	signing.ScriptTypeP2WPKHP2SH: messages.BTCScriptType_SCRIPT_P2WPKH_P2SH,
	signing.ScriptTypeP2WPKH:     messages.BTCScriptType_SCRIPT_P2WPKH,
}

var btcMsgOutputTypeMap = map[txscript.ScriptClass]messages.BTCOutputType{
	txscript.PubKeyHashTy:          messages.BTCOutputType_P2PKH,
	txscript.ScriptHashTy:          messages.BTCOutputType_P2SH,
	txscript.WitnessV0PubKeyHashTy: messages.BTCOutputType_P2WPKH,
	txscript.WitnessV0ScriptHashTy: messages.BTCOutputType_P2WSH,
}

var ethMsgCoinMap = map[string]messages.ETHCoin{
	"eth":            messages.ETHCoin_ETH,
	"eth-erc20-usdt": messages.ETHCoin_ETH,
	"eth-erc20-link": messages.ETHCoin_ETH,
	"eth-erc20-bat":  messages.ETHCoin_ETH,
	"eth-erc20-mkr":  messages.ETHCoin_ETH,
	"eth-erc20-zrx":  messages.ETHCoin_ETH,
	"eth-erc20-dai":  messages.ETHCoin_ETH,
	"teth":           messages.ETHCoin_RopstenETH,
	"reth":           messages.ETHCoin_RinkebyETH,
	"erc20Test":      messages.ETHCoin_RopstenETH,
}
