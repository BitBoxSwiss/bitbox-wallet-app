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

import type { AccountCode, CoinCode, ScriptType, TAccount, CoinUnit, TKeystore } from '@/api/account';

export const findAccount = (
  accounts: TAccount[],
  accountCode: AccountCode
): TAccount | undefined => {
  return accounts.find(({ code }) => accountCode === code);
};

export const isBitcoinOnly = (coinCode: CoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
    return true;
  default:
    return false;
  }
};

export const isBitcoinCoin = (coin: CoinUnit | undefined) => {
  switch (coin) {
  case 'BTC':
  case 'TBTC':
  case 'sat':
  case 'tsat':
    return true;
  default:
    return false;
  }
};

export const isBitcoinBased = (coinCode: CoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'ltc':
  case 'tltc':
    return true;
  default:
    return false;
  }
};

export const isEthereumBased = (coinCode: CoinCode): boolean => {
  return coinCode === 'eth' || coinCode === 'sepeth' || coinCode.startsWith('eth-erc20-');
};

export const getCoinCode = (coinCode: CoinCode): CoinCode | undefined => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
    return 'btc';
  case 'ltc':
  case 'tltc':
    return 'ltc';
  case 'eth':
  case 'sepeth':
    return 'eth';
  }
  if (coinCode.startsWith('eth-erc20-')) {
    return 'eth';
  }
};

export const getScriptName = (scriptType: ScriptType): string => {
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
};

export const customFeeUnit = (coinCode: CoinCode): string => {
  if (isBitcoinBased(coinCode)) {
    return 'sat/vB';
  }
  if (isEthereumBased(coinCode)) {
    return 'Gwei';
  }
  return '';
};

export type TAccountsByKeystore = {
  keystore: TKeystore;
  accounts: TAccount[];
};

// Returns the accounts grouped by the keystore fingerprint.
export const getAccountsByKeystore = (accounts: TAccount[]): TAccountsByKeystore[] => {
  return Object.values(accounts.reduce((acc, account) => {
    const key = account.keystore.rootFingerprint;
    if (!acc[key]) {
      acc[key] = {
        keystore: account.keystore,
        accounts: []
      };
    }
    acc[key].accounts.push(account);
    return acc;
  }, {} as Record<string, TAccountsByKeystore>));
};

type TKeystoreName = {
  keystore: {
    name: string;
  }
};

// Returns true if more than one keystore has the given name.
export const isAmbiguousName = (
  name: string,
  keystoreNames: TKeystoreName[],
): boolean => {
  return keystoreNames.filter(keystore => keystore.keystore.name === name).length > 1;
};

export type TAccountCoinMap = {
  [code in CoinCode]?: TAccount[];
};

export const getAccountsPerCoin = (accounts: TAccount[]): TAccountCoinMap => {
  return accounts.reduce<Partial<TAccountCoinMap>>((accountPerCoin, account) => {
    accountPerCoin[account.coinCode]
      ? accountPerCoin[account.coinCode]!.push(account)
      : accountPerCoin[account.coinCode] = [account];
    return accountPerCoin;
  }, {});
};
