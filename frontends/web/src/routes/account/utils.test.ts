// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { CoinCode, NativeCoinUnit, TAccount } from '@/api/account';
import {
  getAccountsByKeystore,
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

describe('utils/getAccountsByKeystore', () => {

  it('should run and return an empty array', () => {
    const result = getAccountsByKeystore([]);
    expect(result).toBeTypeOf('object');
    expect(result.length).toBe(0);
  });

  it('should return a new empty array', () => {
    const accounts: TAccount[] = [];
    const result = getAccountsByKeystore(accounts);
    expect(accounts).not.toBe(result);
  });

  it('should return one keystore entry with 2 accounts', () => {
    const accounts: TAccount[] = [
      {
        active: true,
        blockExplorerTxPrefix: 'https://mempool.space/testnet/tx/',
        code: 'v0-123de678-tbtc-0',
        coinCode: 'tbtc',
        coinName: 'Bitcoin Testnet',
        coinUnit: 'TBTC',
        isToken: false,
        keystore: {
          connected: false,
          lastConnected: '2023-11-21T10:52:37.36149+01:00',
          name: 'wallet-1',
          rootFingerprint: '123de678s',
          watchonly: true
        },
        name: 'Account 1',
      }, {
        active: true,
        blockExplorerTxPrefix: 'https://mempool.space/testnet/tx/',
        code: 'v0-123de678-tbtc-1',
        coinCode: 'tbtc',
        coinName: 'Bitcoin Testnet',
        coinUnit: 'TBTC',
        isToken: false,
        keystore: {
          connected: false,
          lastConnected: '2023-11-21T10:52:37.36149+01:00',
          name: 'wallet-1',
          rootFingerprint: '123de678s',
          watchonly: true
        },
        name: 'Account 2',
      }
    ];
    const result = getAccountsByKeystore(accounts);
    expect(result.length).toBe(1);
    // @ts-ignore noUncheckedIndexedAccess
    expect(result[0].accounts.length).toBe(2);
    // @ts-ignore noUncheckedIndexedAccess
    expect(result[0].accounts[0].code).toBe(accounts[0].code);
    // @ts-ignore noUncheckedIndexedAccess
    expect(result[0].accounts[1].code).toBe(accounts[1].code);
  });

  it('should return two keystores with their respective accounts', () => {

    const accounts: TAccount[] = [
      createAccount({ code: 'a1', name: 'A1', keystore: { name: 'W1', rootFingerprint: 'w1' } }),
      createAccount({ code: 'a2', name: 'A2', keystore: { name: 'W1', rootFingerprint: 'w1' } }),
      createAccount({ code: 'b1', name: 'B1', keystore: { name: 'W2', rootFingerprint: 'w2' } }),
      createAccount({ code: 'b2', name: 'B2', keystore: { name: 'W2', rootFingerprint: 'w2' } }),
      createAccount({ code: 'b3', name: 'B3', keystore: { name: 'W2', rootFingerprint: 'w2' } }),
      createAccount({ code: 'b4', name: 'B4', keystore: { name: 'W2', rootFingerprint: 'w2' } }),
      createAccount({ code: 'a3', name: 'A3', keystore: { name: 'W1', rootFingerprint: 'w1' } }),
    ];
    const result = getAccountsByKeystore(accounts);

    expect(result.length).toBe(2);
    // @ts-ignore noUncheckedIndexedAccess
    expect(result[0].accounts.length).toBe(3);
    // @ts-ignore noUncheckedIndexedAccess
    expect(result[1].accounts.length).toBe(4);

    // @ts-ignore noUncheckedIndexedAccess
    expect(result[0].accounts.every(({ keystore }) => keystore.rootFingerprint === 'w1')).toBe(true);
    // @ts-ignore noUncheckedIndexedAccess
    expect(result[1].accounts.every(({ keystore }) => keystore.rootFingerprint === 'w2')).toBe(true);
    // @ts-ignore noUncheckedIndexedAccess
    expect(result[0].accounts[2].code).toBe(accounts[6].code);
    // @ts-ignore noUncheckedIndexedAccess
    expect(result[1].accounts[3].code).toBe(accounts[5].code);
  });

  it('sorts keystores by wallet name and then root fingerprint', () => {
    const accounts: TAccount[] = [
      createAccount({ code: 'same-2', name: 'Same 2', keystore: { name: 'Same', rootFingerprint: 'w2' } }),
      createAccount({ code: 'beta-1', name: 'Beta 1', keystore: { name: 'Beta', rootFingerprint: 'w3' } }),
      createAccount({ code: 'same-1', name: 'Same 1', keystore: { name: 'Same', rootFingerprint: 'w1' } }),
      createAccount({ code: 'alpha-1', name: 'Alpha 1', keystore: { name: 'Alpha', rootFingerprint: 'w9' } }),
    ];

    const result = getAccountsByKeystore(accounts);

    expect(result.map(({ keystore }) => `${keystore.name}:${keystore.rootFingerprint}`)).toEqual([
      'Alpha:w9',
      'Beta:w3',
      'Same:w1',
      'Same:w2',
    ]);
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
