// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  formatExcessLightningBalanceLimit,
  formatLightningBalanceLimit,
  formatRemainingLightningBalanceLimit,
  getLightningBalanceLimitError,
  hasExceededLightningBalanceLimit,
  hasReachedLightningBalanceLimit,
  lightningBalanceLimitErrorCode,
} from './limits';

const limit = {
  amount: {
    amount: '0.002',
    conversions: {},
    estimated: false,
    unit: 'BTC' as const,
  },
  amountLabel: '0.002 BTC',
  remainingAmount: {
    amount: '0.0005',
    conversions: {},
    estimated: false,
    unit: 'BTC' as const,
  },
  remainingAmountLabel: '0.0005 BTC',
  excessAmount: {
    amount: '0',
    conversions: {},
    estimated: false,
    unit: 'BTC' as const,
  },
  excessAmountLabel: '0 BTC',
  limitReached: false,
  limitExceeded: false,
  amountExceedsLimit: false,
};

describe('lightning balance limit', () => {
  it('uses backend-provided display labels', () => {
    expect(formatLightningBalanceLimit(limit)).toBe('0.002 BTC');
    expect(formatRemainingLightningBalanceLimit(limit)).toBe('0.0005 BTC');
    expect(formatExcessLightningBalanceLimit({
      ...limit,
      excessAmountLabel: '0.0001 BTC',
    })).toBe('0.0001 BTC');
  });

  it('uses backend-provided limit state', () => {
    expect(hasReachedLightningBalanceLimit({ ...limit, limitReached: true })).toBe(true);
    expect(hasReachedLightningBalanceLimit(limit)).toBe(false);
    expect(hasExceededLightningBalanceLimit({ ...limit, limitExceeded: true })).toBe(true);
    expect(hasExceededLightningBalanceLimit(limit)).toBe(false);
  });

  it('uses backend-provided amount validation state', () => {
    expect(getLightningBalanceLimitError({ ...limit, amountExceedsLimit: true })).toBe(lightningBalanceLimitErrorCode);
    expect(getLightningBalanceLimitError(limit)).toBeUndefined();
  });
});
