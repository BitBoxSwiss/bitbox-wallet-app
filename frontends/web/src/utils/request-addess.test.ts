// SPDX-License-Identifier: Apache-2.0

import { expect, it } from 'vitest';
import { type Slip24 } from 'request-address';
import { convertSlip24 } from './request-addess';

// Pocket's string refund becomes an object without changing signed values, memo order or the input.
it('adapts Pocket refund memos to the backend schema', () => {
  const payload: Slip24 = {
    recipientName: 'Pocket',
    nonce: null,
    memos: [
      { type: 'text', text: 'Payment' },
      { type: 'refund', refund: 'bc1qq6hag67dl53wl99vzg42z8eyzfz2xlkvxechjp' },
      { type: 'coinPurchase', coinPurchase: { coinType: 60, amount: '0.25 ETH', address: '0x171A32C3Dcbc92fD74026cBA6e3f9cB2c2bb938e' } },
    ],
    outputs: [{ amount: 100000, address: 'bc1qaz6lphpyysqhpwl42nezgt3qyk42d9lc9tdrpw' }],
    signature: 'c2ln',
  };
  const original = JSON.stringify(payload);

  expect(convertSlip24(payload)).toEqual({
    ...payload,
    memos: [
      payload.memos[0],
      { type: 'refund', refund: { address: 'bc1qq6hag67dl53wl99vzg42z8eyzfz2xlkvxechjp' } },
      payload.memos[2],
    ],
  });
  expect(JSON.stringify(payload)).toBe(original);
});

// Ordinary Pocket payments need no refund memo and must still reach the backend unchanged.
it('preserves Pocket payment requests without refunds', () => {
  const payload: Slip24 = {
    recipientName: 'Pocket',
    nonce: null,
    memos: [{ type: 'text', text: 'Payment' }],
    outputs: [{ amount: 100000, address: 'bc1qaz6lphpyysqhpwl42nezgt3qyk42d9lc9tdrpw' }],
    signature: 'c2ln',
  };

  expect(convertSlip24(payload)).toEqual(payload);
});
