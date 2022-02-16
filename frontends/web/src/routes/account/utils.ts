/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CoinCode, ScriptType } from '../../api/account';

export function isBitcoinOnly(coinCode: CoinCode): boolean {
    switch (coinCode) {
    case 'btc':
    case 'tbtc':
        return true;
    default:
        return false;
    }
}

export function isBitcoinBased(coinCode: CoinCode): boolean {
    switch (coinCode) {
    case 'btc':
    case 'tbtc':
    case 'ltc':
    case 'tltc':
        return true;
    default:
        return false;
    }
}

export function isEthereumBased(coinCode: CoinCode): boolean {
    return coinCode === 'eth' || coinCode === 'teth' || coinCode === 'reth' || coinCode.startsWith('eth-erc20-');
}

export function getCoinCode(coinCode: CoinCode): CoinCode | undefined {
    switch (coinCode) {
        case 'btc':
        case 'tbtc':
            return 'btc';
        case 'ltc':
        case 'tltc':
            return 'ltc';
        case 'eth':
        case 'teth':
        case 'reth':
            return 'eth';
    }
}


export function getScriptName(scriptType: ScriptType): string {
    switch (scriptType) {
        case 'p2pkh':
            return 'Legacy';
        case 'p2wpkh-p2sh':
            return 'Segwit';
        case 'p2wpkh':
            return 'Native segwit (bech32)';
        case 'p2tr':
            return 'Taproot (bech32m)';
    }
}

export function customFeeUnit(coinCode: CoinCode): string {
    if (isBitcoinBased(coinCode)) {
        return 'sat/vB';
    }
    if (isEthereumBased(coinCode)) {
        return 'Gwei';
    }
    return '';
}
