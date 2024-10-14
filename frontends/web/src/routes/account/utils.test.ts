/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { describe, it, expect } from 'vitest';
import { CoinCode, CoinUnit, IAccount } from '@/api/account';
import { getAccountsByKeystore } from './utils';


const createAccount = ({
  keystore,
  ...props
}: Partial<Omit<IAccount, 'keystore'>> & {
  keystore: Partial<IAccount['keystore']> | undefined
}) => {
  return {
    active: true,
    blockExplorerTxPrefix: 'https://blockstream.info/testnet/tx/',
    code: 'v0-123de678-tbtc-0',
    coinCode: 'tbtc' as CoinCode,
    coinName: 'Bitcoin Testnet',
    coinUnit: 'TBTC' as CoinUnit,
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
    watch: true,
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
    const accounts: IAccount[] = [];
    const result = getAccountsByKeystore(accounts);
    expect(accounts).not.toBe(result);
  });

  it('should return one keystore entry with 2 accounts', () => {
    const accounts: IAccount[] = [
      {
        active: true,
        blockExplorerTxPrefix: 'https://blockstream.info/testnet/tx/',
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
        watch: true
      }, {
        active: true,
        blockExplorerTxPrefix: 'https://blockstream.info/testnet/tx/',
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
        watch: true
      }
    ];
    const result = getAccountsByKeystore(accounts);
    expect(result.length).toBe(1);
    expect(result[0].accounts.length).toBe(2);
    expect(result[0].accounts[0].code).toBe(accounts[0].code);
    expect(result[0].accounts[1].code).toBe(accounts[1].code);
  });

  it('should return two keystores with their respective accounts', () => {

    const accounts: IAccount[] = [
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
    expect(result[0].accounts.length).toBe(3);
    expect(result[1].accounts.length).toBe(4);

    expect(result[0].accounts.every(({ keystore }) => keystore.rootFingerprint === 'w1')).toBe(true);
    expect(result[1].accounts.every(({ keystore }) => keystore.rootFingerprint === 'w2')).toBe(true);
    expect(result[0].accounts[2].code).toBe(accounts[6].code);
    expect(result[1].accounts[3].code).toBe(accounts[5].code);
  });

});
