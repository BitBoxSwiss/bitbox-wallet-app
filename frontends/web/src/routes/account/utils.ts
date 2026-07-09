// SPDX-License-Identifier: Apache-2.0

import type { AccountCode, CoinCode, ScriptType, TAccount, TAccountBase, TKeystore } from '@/api/account';

export const findAccount = <T extends { code: AccountCode }>(
  accounts: T[],
  accountCode: AccountCode
): T | undefined => {
  return accounts.find(({ code }) => accountCode === code);
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
