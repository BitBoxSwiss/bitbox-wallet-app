// SPDX-License-Identifier: Apache-2.0

import type { AccountCode, CoinCode, ScriptType, TAccount, TAccountBase, CoinUnit, TKeystore } from '@/api/account';
import type { BtcUnit } from '@/api/coins';

export const findAccount = <T extends { code: AccountCode }>(
  accounts: T[],
  accountCode: AccountCode
): T | undefined => {
  return accounts.find(({ code }) => accountCode === code);
};

export const isBitcoinOnly = (coinCode: CoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
    return true;
  default:
    return false;
  }
};

export const isBitcoinCoin = (coin: CoinUnit | undefined) => {
  switch (coin) {
  case 'BTC':
  case 'TBTC':
  case 'RBTC':
  case 'sat':
  case 'tsat':
    return true;
  default:
    return false;
  }
};

export const getDisplayedCoinUnit = (
  coinCode: CoinCode,
  coinUnit: CoinUnit,
  btcUnit: BtcUnit | undefined,
): CoinUnit => {
  if (!isBitcoinOnly(coinCode) || btcUnit !== 'sat') {
    return coinUnit;
  }
  return coinCode === 'tbtc' ? 'tsat' : 'sat';
};

export const isBitcoinBased = (coinCode: CoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
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

export const isMessageSigningSupported = (coinCode: CoinCode): boolean => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'eth':
  case 'sepeth':
  case 'rbtc':
    return true;
  default:
    return false;
  }
};

export const getAddressURIPrefix = (coinCode?: CoinCode): string => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
    return 'bitcoin:';
  case 'ltc':
  case 'tltc':
    return 'litecoin:';
  default:
    return '';
  }
};

export const getCoinCode = (coinCode: CoinCode): CoinCode | undefined => {
  switch (coinCode) {
  case 'btc':
  case 'tbtc':
  case 'rbtc':
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

export type TAccountsByKeystore<T extends { keystore: TKeystore } = TAccount> = {
  keystore: TKeystore;
  accounts: T[];
};

// Returns the accounts grouped by the keystore fingerprint.
export const getAccountsByKeystore = <T extends TAccountBase>(accounts: T[]): TAccountsByKeystore<T>[] => {
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
  }, {} as Record<string, TAccountsByKeystore<T>>));
};

type TKeystoreName = {
  keystore: {
    name: string;
  };
};

// Returns true if more than one keystore has the given name.
export const isAmbiguousName = (
  name: string,
  keystoreNames: TKeystoreName[],
): boolean => {
  return keystoreNames.filter(keystore => keystore.keystore.name === name).length > 1;
};

/** Matches `/account/<code>/addresses/<addressID>/verify`. */
const ADDRESS_VERIFY_ROUTE_RE = /^\/account\/[^/]+\/addresses\/[^/]+\/verify$/;

export const isAddressVerifyRoute = (pathname: string): boolean =>
  ADDRESS_VERIFY_ROUTE_RE.test(pathname);

/** Query param used to skip device verification on the address verify route. */
export const SKIP_DEVICE_VERIFICATION_PARAM = 'skipDeviceVerification';

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
