// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { CoinCode } from '@/api/account';
import { useCoinUnitPrice } from './coin-unit-price';

vi.mock('@/api/coins', () => ({
  getCoinFiatPrices: vi.fn(),
  subscribeCoinFiatPrices: vi.fn(() => () => () => {}),
}));

import { getCoinFiatPrices } from '@/api/coins';

const mockGetCoinFiatPrices = vi.mocked(getCoinFiatPrices);

describe('useCoinUnitPrice', () => {
  it('returns undefined while loading', () => {
    mockGetCoinFiatPrices.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useCoinUnitPrice('btc' as CoinCode),
    );
    expect(result.current).toBeUndefined();
  });

  it('returns TAmountWithConversions on success', async () => {
    mockGetCoinFiatPrices.mockResolvedValue({
      success: true as const,
      amount: '1',
      unit: 'BTC',
      conversions: { USD: '60000.00', EUR: '55000.00' } as Record<string, string>,
      estimated: false,
    });
    const { result } = renderHook(
      () => useCoinUnitPrice('btc' as CoinCode),
    );
    await waitFor(() => expect(result.current).toEqual({
      success: true,
      amount: '1',
      unit: 'BTC',
      conversions: { USD: '60000.00', EUR: '55000.00' },
      estimated: false,
    }));
    expect(mockGetCoinFiatPrices).toHaveBeenCalledWith('btc');
  });

  it('returns undefined on API failure', async () => {
    mockGetCoinFiatPrices.mockResolvedValue({
      success: false as const,
    });
    const { result } = renderHook(
      () => useCoinUnitPrice('btc' as CoinCode),
    );
    await waitFor(() => {
      expect(mockGetCoinFiatPrices).toHaveBeenCalled();
      expect(result.current).toBeUndefined();
    });
  });
});
