// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { TAccountsByKeystore } from '@/api/account';
import { createGroupedOptions } from './services';

const accountsByKeystore: TAccountsByKeystore[] = [
  {
    keystore: {
      connected: true,
      lastConnected: '2023-11-21T10:52:37.36149+01:00',
      name: 'Same',
      rootFingerprint: 'aaaa1111',
      watchonly: false,
    },
    accounts: [
      {
        active: true,
        blockExplorerTxPrefix: 'https://mempool.space/testnet/tx/',
        coinCode: 'tbtc',
        coinName: 'Bitcoin Testnet',
        coinUnit: 'TBTC',
        code: 'account-a',
        isToken: false,
        keystore: {
          connected: true,
          lastConnected: '2023-11-21T10:52:37.36149+01:00',
          name: 'Same',
          rootFingerprint: 'aaaa1111',
          watchonly: false,
        },
        name: 'Account A',
      },
    ],
  },
  {
    keystore: {
      connected: false,
      lastConnected: '2023-11-21T10:52:37.36149+01:00',
      name: 'Same',
      rootFingerprint: 'bbbb2222',
      watchonly: true,
    },
    accounts: [
      {
        active: true,
        blockExplorerTxPrefix: 'https://mempool.space/testnet/tx/',
        coinCode: 'sepeth',
        coinName: 'Ethereum Sepolia',
        coinUnit: 'SEPETH',
        code: 'account-b',
        isToken: false,
        keystore: {
          connected: false,
          lastConnected: '2023-11-21T10:52:37.36149+01:00',
          name: 'Same',
          rootFingerprint: 'bbbb2222',
          watchonly: true,
        },
        name: 'Account B',
      },
    ],
  },
];

describe('groupedaccountselector/services', () => {
  it('creates grouped options from grouped accounts', () => {
    const result = createGroupedOptions(accountsByKeystore);

    expect(result).toEqual([
      {
        connected: true,
        label: 'Same (aaaa1111)',
        options: [
          { label: 'Account A', value: 'account-a', coinCode: 'tbtc', disabled: false },
        ],
      },
      {
        connected: false,
        label: 'Same (bbbb2222)',
        options: [
          { label: 'Account B', value: 'account-b', coinCode: 'sepeth', disabled: false },
        ],
      },
    ]);
  });
});
