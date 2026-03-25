// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { CoinCode, NativeCoinUnit, TAccount, TAccountsByKeystore } from '@/api/account';
import {
  filterAccountsByKeystore,
  flattenAccountsByKeystore,
  getCoinCode,
  isBitcoinBased,
  isBitcoinCoin,
  isBitcoinOnly,
} from './utils';


const createAccount = ({
  keystore,
  ...props
}: Partial<Omit<TAccount, 'keystore'>> & {
  keystore: Partial<TAccount['keystore']> | undefined;
}) => {
  return {
    active: true,
    blockExplorerTxPrefix: 'https://mempool.space/testnet/tx/',
    code: 'v0-123de678-tbtc-0',
    coinCode: 'tbtc' as CoinCode,
    coinName: 'Bitcoin Testnet',
    coinUnit: 'TBTC' as NativeCoinUnit,
    isToken: false,
    keystore: {
      connected: false,
      lastConnected: '2023-11-21T10:52:37.36149+01:00',
      name: 'wallet-1',
      rootFingerprint: '123de678s',
      watchonly: true,
      ...keystore
    },
    name: 'Account 1',
    ...props,
  };
};

const createAccountsByKeystore = (groups: Array<{
  keystore: Partial<TAccount['keystore']>;
  accounts: Array<Partial<TAccount>>;
}>): TAccountsByKeystore[] => {
  return groups.map(({ keystore, accounts }) => ({
    keystore: {
      connected: false,
      lastConnected: '2023-11-21T10:52:37.36149+01:00',
      name: 'wallet-1',
      rootFingerprint: '123de678s',
      watchonly: true,
      ...keystore,
    },
    accounts: accounts.map((account, index) => createAccount({
      code: `account-${index}`,
      keystore,
      ...account,
    })),
  }));
};

describe('utils/flattenAccountsByKeystore', () => {

  it('should run and return an empty array', () => {
    const result = flattenAccountsByKeystore([]);
    expect(result).toBeTypeOf('object');
    expect(result.length).toBe(0);
  });

  it('should flatten accounts while preserving group and account order', () => {
    const accountsByKeystore = createAccountsByKeystore([
      {
        keystore: { name: 'W1', rootFingerprint: 'w1' },
        accounts: [
          { code: 'a1', name: 'A1' },
          { code: 'a2', name: 'A2' },
        ],
      },
      {
        keystore: { name: 'W2', rootFingerprint: 'w2' },
        accounts: [
          { code: 'b1', name: 'B1' },
          { code: 'b2', name: 'B2' },
        ],
      },
    ]);

    expect(flattenAccountsByKeystore(accountsByKeystore).map(({ code }) => code)).toEqual([
      'a1',
      'a2',
      'b1',
      'b2',
    ]);
  });
});

describe('utils/filterAccountsByKeystore', () => {
  it('filters accounts, preserves order and removes empty groups', () => {
    const accountsByKeystore = createAccountsByKeystore([
      {
        keystore: { name: 'W1', rootFingerprint: 'w1' },
        accounts: [
          { code: 'a1', active: false },
          { code: 'a2', active: true },
        ],
      },
      {
        keystore: { name: 'W2', rootFingerprint: 'w2' },
        accounts: [
          { code: 'b1', active: false },
        ],
      },
      {
        keystore: { name: 'W3', rootFingerprint: 'w3' },
        accounts: [
          { code: 'c1', active: true },
          { code: 'c2', active: true },
        ],
      },
    ]);

    const result = filterAccountsByKeystore(accountsByKeystore, ({ active }) => active);

    expect(result.map(({ keystore }) => keystore.rootFingerprint)).toEqual(['w1', 'w3']);
    expect(result[0]?.accounts.map(({ code }) => code)).toEqual(['a2']);
    expect(result[1]?.accounts.map(({ code }) => code)).toEqual(['c1', 'c2']);
  });

  it('returns new groups without mutating the original input', () => {
    const accountsByKeystore = createAccountsByKeystore([
      {
        keystore: { name: 'W1', rootFingerprint: 'w1' },
        accounts: [
          { code: 'a1', active: true },
          { code: 'a2', active: false },
        ],
      },
    ]);

    const result = filterAccountsByKeystore(accountsByKeystore, ({ active }) => active);

    expect(result).not.toBe(accountsByKeystore);
    expect(result[0]).not.toBe(accountsByKeystore[0]);
    expect(accountsByKeystore[0]?.accounts.map(({ code }) => code)).toEqual(['a1', 'a2']);
    expect(result[0]?.accounts.map(({ code }) => code)).toEqual(['a1']);
  });
});

describe('utils/bitcoin coin helpers', () => {
  it('treats rbtc coin codes as bitcoin-only and bitcoin-based', () => {
    expect(isBitcoinOnly('rbtc')).toBe(true);
    expect(isBitcoinBased('rbtc')).toBe(true);
  });

  it('treats rbtc unit as bitcoin coin', () => {
    expect(isBitcoinCoin('RBTC' as NativeCoinUnit)).toBe(true);
  });

  it('maps rbtc to canonical btc coin code', () => {
    expect(getCoinCode('rbtc' as CoinCode)).toBe('btc');
  });
});
