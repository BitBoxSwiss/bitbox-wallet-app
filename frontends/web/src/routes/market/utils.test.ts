// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { getRequiredKeystoreFeature } from './utils';

describe('getRequiredKeystoreFeature', () => {
  it.each([
    ['pocket', 'buy', 'btc', 'messageSigning'],
    ['pocket', 'sell', 'btc', 'paymentRequests'],
    ['btcdirect', 'sell', 'btc', 'btcTransactionSigning'],
    ['btcdirect', 'sell', 'eth', 'ethTransactionSigning'],
    ['btcdirect', 'sell', 'eth-erc20-usdt', 'ethTransactionSigning'],
    ['bitrefill', 'spend', 'ltc', 'btcTransactionSigning'],
    ['bitrefill', 'spend', 'eth', 'ethTransactionSigning'],
    ['swapkit', 'swap', 'btc', 'swapPaymentRequests'],
  ] as const)('maps %s %s with %s', (vendor, action, coinCode, expected) => {
    expect(getRequiredKeystoreFeature(vendor, action, coinCode)).toBe(expected);
  });

  it('does not require signing support for non-signing workflows', () => {
    expect(getRequiredKeystoreFeature('btcdirect', 'buy', 'btc')).toBeUndefined();
    expect(getRequiredKeystoreFeature('moonpay', 'buy', 'btc')).toBeUndefined();
  });
});
