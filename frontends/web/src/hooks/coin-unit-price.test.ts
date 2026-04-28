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

  it('returns coin fiat prices on success', async () => {
    mockGetCoinFiatPrices.mockResolvedValue(
      { USD: '60000.00', EUR: '55000.00' } as Record<string, string>,
    );
    const { result } = renderHook(
      () => useCoinUnitPrice('btc' as CoinCode, 'BTC'),
    );
    await waitFor(() => expect(result.current).toEqual(
      { USD: '60000.00', EUR: '55000.00' },
    ));
    expect(mockGetCoinFiatPrices).toHaveBeenCalledWith('btc');
  });
});
