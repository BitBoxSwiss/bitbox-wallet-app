// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { RatesContext } from '@/contexts/RatesContext';
import type { CoinCode, CoinUnit } from '@/api/account';
import { useCoinUnitPrice } from './coin-unit-price';

vi.mock('@/api/coins', () => ({
  convertToCurrency: vi.fn(),
}));

import { convertToCurrency } from '@/api/coins';

const mockConvertToCurrency = vi.mocked(convertToCurrency);

const wrapper = (defaultCurrency = 'USD' as const) =>
  ({ children }: { children: React.ReactNode }) =>
    createElement(
      RatesContext.Provider,
      { value: { defaultCurrency } as any },
      children,
    );

describe('useCoinUnitPrice', () => {
  it('returns undefined while loading', () => {
    mockConvertToCurrency.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useCoinUnitPrice('btc', 'BTC'),
      { wrapper: wrapper('USD') },
    );
    expect(result.current).toBeUndefined();
  });

  it('returns TAmountWithConversions on success', async () => {
    mockConvertToCurrency.mockResolvedValue({
      success: true as const,
      fiatAmount: '60\'000.00',
    });
    const { result } = renderHook(
      () => useCoinUnitPrice('btc', 'BTC'),
      { wrapper: wrapper('USD') },
    );
    await waitFor(() => expect(result.current).toEqual({
      amount: '1',
      unit: 'BTC',
      conversions: { USD: '60\'000.00' },
      estimated: false,
    }));
    expect(mockConvertToCurrency).toHaveBeenCalledWith({
      amount: '1',
      coinCode: 'btc',
      fiatUnit: 'USD',
    });
  });

  it('returns undefined on API failure', async () => {
    mockConvertToCurrency.mockResolvedValue({
      success: false as const,
    });
    const { result } = renderHook(
      () => useCoinUnitPrice('btc', 'BTC'),
      { wrapper: wrapper('USD') },
    );
    await waitFor(() => {
      expect(mockConvertToCurrency).toHaveBeenCalled();
      expect(result.current).toBeUndefined();
    });
  });

  it('re-fetches when coinCode changes', async () => {
    mockConvertToCurrency.mockResolvedValue({
      success: true as const,
      fiatAmount: '60\'000.00',
    });
    const { result, rerender } = renderHook(
      ({ coinCode, unit }: { coinCode: CoinCode; unit: CoinUnit }) => useCoinUnitPrice(coinCode, unit),
      {
        wrapper: wrapper('USD'),
        initialProps: { coinCode: 'btc' as CoinCode, unit: 'BTC' as CoinUnit },
      },
    );
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.conversions).toEqual({ USD: '60\'000.00' });

    mockConvertToCurrency.mockResolvedValue({
      success: true as const,
      fiatAmount: '3400.00',
    });
    rerender({ coinCode: 'eth' as CoinCode, unit: 'ETH' as CoinUnit });

    await waitFor(() => expect(result.current).toEqual({
      amount: '1',
      unit: 'ETH',
      conversions: { USD: '3400.00' },
      estimated: false,
    }));
    expect(mockConvertToCurrency).toHaveBeenLastCalledWith({
      amount: '1',
      coinCode: 'eth',
      fiatUnit: 'USD',
    });
  });
});
