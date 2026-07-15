// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoinCode } from '@/api/account';
import type { TSubscriptionCallback } from '@/api/subscribe';
import { useCoinUnitPrice } from './coin-unit-price';

const coinApiMocks = vi.hoisted(() => ({
  subscribeCoinFiatPrices: vi.fn(),
}));

vi.mock('@/api/coins', () => coinApiMocks);

describe('useCoinUnitPrice', () => {
  let notifyPrice: TSubscriptionCallback<any> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    notifyPrice = undefined;
    coinApiMocks.subscribeCoinFiatPrices.mockImplementation(() => (
      (cb: TSubscriptionCallback<any>) => {
        notifyPrice = cb;
        return () => {};
      }
    ));
  });

  it('returns undefined before the initial snapshot', () => {
    const { result } = renderHook(
      () => useCoinUnitPrice('btc' as CoinCode),
    );
    expect(result.current).toBeUndefined();
  });

  it('returns TAmountWithConversions on success', () => {
    const price = {
      amount: '1',
      unit: 'BTC',
      conversions: { USD: '60000.00', EUR: '55000.00' } as Record<string, string>,
      estimated: false,
    };
    const { result } = renderHook(
      () => useCoinUnitPrice('btc' as CoinCode, 'BTC'),
    );
    act(() => notifyPrice?.(price));
    expect(result.current).toEqual(price);
    expect(coinApiMocks.subscribeCoinFiatPrices).toHaveBeenCalledWith('btc');
  });
});
