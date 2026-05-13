// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { describe, expect, it } from 'vitest';
import type { TLightningBalance } from '@/api/lightning';
import { customAmountExceedsAvailableBalance } from './lightning-send-context';

const balance = (
  availableSat: number,
  formattedAmount = `${availableSat}`,
  unit: TLightningBalance['available']['unit'] = 'sat',
): TLightningBalance => ({
  hasAvailable: true,
  availableSat,
  available: {
    amount: formattedAmount,
    unit,
    estimated: false,
  },
  hasIncoming: false,
  incoming: {
    amount: '0',
    unit,
    estimated: false,
  },
});

describe('lightning send context', () => {
  describe('customAmountExceedsAvailableBalance', () => {
    it('returns true when the custom amount exceeds available balance', () => {
      expect(customAmountExceedsAvailableBalance(101, balance(100))).toBe(true);
    });

    it('uses raw sats instead of the formatted display amount', () => {
      expect(customAmountExceedsAvailableBalance(101, balance(100, '0.00000100', 'BTC'))).toBe(true);
    });

    it('returns false when the custom amount is within available balance', () => {
      expect(customAmountExceedsAvailableBalance(100, balance(100))).toBe(false);
    });

    it('returns false while balance is still loading', () => {
      expect(customAmountExceedsAvailableBalance(100, undefined)).toBe(false);
    });
  });
});
