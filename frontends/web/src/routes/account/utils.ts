/**
 * Copyright 2018 Shift Devices AG
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

export function isBitcoinBased(coinCode: string): boolean {
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

export function isEthereumBased(coinCode: string): boolean {
    return coinCode === 'eth' || coinCode.startsWith('eth-erc20-');
}
