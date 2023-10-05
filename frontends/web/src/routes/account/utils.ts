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

import { CoinCode, ScriptType, IAccount, CoinUnit } from '../../api/account';

export function findAccount(accounts: IAccount[], accountCode: string): IAccount | undefined {
  return accounts.find(({ code }) => accountCode === code);
}

export function getCryptoName(cryptoLabel: string, account?: IAccount): string {
  if (account && isBitcoinOnly(account.coinCode)) {
    return 'Bitcoin';
  }
  return cryptoLabel;
}

export function isBitcoinOnly(coinCode: CoinCode): boolean {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
    return true;
  default:
    return false;
  }
}

export const isBitcoinCoin = (coin: CoinUnit) => (coin === 'BTC') || (coin === 'TBTC') || (coin === 'sat') || (coin === 'tsat');

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
  return coinCode === 'eth' || coinCode === 'goeth' || coinCode === 'sepeth' || coinCode.startsWith('eth-erc20-');
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
  case 'goeth':
  case 'sepeth':
    return 'eth';
  }
}


export function getScriptName(scriptType: ScriptType): string {
  switch (scriptType) {
  case 'p2pkh':
    return 'Legacy (P2PKH)';
  case 'p2wpkh-p2sh':
    return 'Wrapped Segwit (P2WPKH-P2SH)';
  case 'p2wpkh':
    return 'Native segwit (bech32, P2WPKH)';
  case 'p2tr':
    return 'Taproot (bech32m, P2TR)';
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
