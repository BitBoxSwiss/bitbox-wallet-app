/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2020 Shift Crypto AG
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

import { CoinCode } from './account';

export function isBitcoin(code: string): boolean {
    switch (code) {
    case 'btc':
    case 'btc-p2wpkh':
    case 'btc-p2wpkh-p2sh':
    case 'btc-p2pkh':
    case 'tbtc':
    case 'tbtc-p2wpkh':
    case 'tbtc-p2wpkh-p2sh':
    case 'tbtc-p2pkh':
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
    return coinCode === 'eth' || coinCode.startsWith('eth-erc20-');
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
