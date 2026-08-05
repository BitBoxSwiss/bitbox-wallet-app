// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  formatExcessLightningFundingLimit,
  formatLightningFundingLimit,
  formatRemainingLightningFundingLimit,
  getLightningFundingLimitError,
  hasExceededLightningFundingLimit,
  hasReachedLightningFundingLimit,
  lightningBalanceLimitErrorCode,
} from './limits';

const limit = {
  limitSat: 200000,
  marginSat: 50000,
};

describe('lightning funding limit', () => {
  it('formats limit, remaining capacity, and projected excess', () => {
    expect(formatLightningFundingLimit(limit)).toBe('200000 sat');
    expect(formatRemainingLightningFundingLimit(limit)).toBe('50000 sat');
    expect(formatExcessLightningFundingLimit(limit, 50001)).toBe('1 sat');
  });

  it('derives reached and exceeded state from signed margin', () => {
    expect(hasReachedLightningFundingLimit(limit)).toBe(false);
    expect(hasReachedLightningFundingLimit({ ...limit, marginSat: 0 })).toBe(true);
    expect(hasExceededLightningFundingLimit({ ...limit, marginSat: 0 })).toBe(false);
    expect(hasExceededLightningFundingLimit({ ...limit, marginSat: -1 })).toBe(true);
  });

  it('rejects only requested amounts above the margin', () => {
    expect(getLightningFundingLimitError(limit, 50001)).toBe(lightningBalanceLimitErrorCode);
    expect(getLightningFundingLimitError(limit, 50000)).toBeUndefined();
  });
});
