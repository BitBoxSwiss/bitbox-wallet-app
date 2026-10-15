// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { CoinCode } from '@/api/account';
import { useCoinUnitPrice } from './coin-unit-price';

vi.mock('@/api/coins', () => ({
  getCoinFiatPrices: vi.fn(),
  subscribeCoinFiatPrices: vi.fn(() => () => {}),
}));

import { getCoinFiatPrices, subscribeCoinFiatPrices } from '@/api/coins';

const mockGetCoinFiatPrices = vi.mocked(getCoinFiatPrices);
const mockSubscribeCoinFiatPrices = vi.mocked(subscribeCoinFiatPrices);

describe('useCoinUnitPrice', () => {
  beforeEach(() => {
    mockGetCoinFiatPrices.mockReset();
    mockSubscribeCoinFiatPrices.mockClear();
  });

  it('returns undefined while loading', () => {
    mockGetCoinFiatPrices.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useCoinUnitPrice('btc' as CoinCode),
    );
    expect(result.current).toBeUndefined();
  });

  it('returns TAmountWithConversions on success', async () => {
    mockGetCoinFiatPrices.mockResolvedValue({
      amount: '1',
      unit: 'BTC',
      conversions: { USD: '60000.00', EUR: '55000.00' } as Record<string, string>,
      estimated: false,
    });
    const { result } = renderHook(
      () => useCoinUnitPrice('btc' as CoinCode, 'BTC'),
    );
    await waitFor(() => expect(result.current).toEqual({
      amount: '1',
      unit: 'BTC',
      conversions: { USD: '60000.00', EUR: '55000.00' },
      estimated: false,
    }));
    expect(mockGetCoinFiatPrices).toHaveBeenCalledWith('btc');
  });

  it('uses bitcoin prices for lightning', async () => {
    mockGetCoinFiatPrices.mockResolvedValue({
      amount: '1',
      unit: 'BTC',
      conversions: { USD: '60000.00' } as Record<string, string>,
      estimated: false,
    });
    const { result } = renderHook(
      () => useCoinUnitPrice('lightning', 'BTC'),
    );
    await waitFor(() => expect(result.current).toEqual({
      amount: '1',
      unit: 'BTC',
      conversions: { USD: '60000.00' },
      estimated: false,
    }));
    expect(mockGetCoinFiatPrices).toHaveBeenCalledWith('btc');
    expect(mockSubscribeCoinFiatPrices).toHaveBeenCalledWith('btc');
  });
});
