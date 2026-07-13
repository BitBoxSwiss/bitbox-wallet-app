// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBtcSatAmount } from '@/api/coins';
import { useSatFiatAmount } from './use-sat-fiat-amount';

vi.mock('@/api/coins', () => ({
  getBtcSatAmount: vi.fn(),
}));

const mockGetBtcSatAmount = vi.mocked(getBtcSatAmount);
type TResponse = Awaited<ReturnType<typeof getBtcSatAmount>>;

const successfulResponse = (amount: string, fiatAmount: string): TResponse => ({
  success: true,
  amount: {
    amount,
    conversions: { USD: fiatAmount },
    unformattedConversions: { USD: fiatAmount },
    unit: 'sat',
    estimated: false,
  },
});

describe('useSatFiatAmount', () => {
  beforeEach(() => {
    mockGetBtcSatAmount.mockReset();
  });

  it('converts sats to fiat', async () => {
    mockGetBtcSatAmount.mockResolvedValue(successfulResponse('1200', '10.50'));
    const { result } = renderHook(() => useSatFiatAmount({ defaultCurrency: 'USD' }));

    await act(async () => {
      await result.current.handleSatsAmountChange('1200');
    });

    expect(mockGetBtcSatAmount).toHaveBeenCalledWith({ source: 'sat', amount: '1200' });
    expect(result.current.inputSatsText).toBe('1200');
    expect(result.current.inputFiatText).toBe('10.50');
    expect(result.current.amountSat).toBe(1200);
  });

  it('converts fiat to sats', async () => {
    mockGetBtcSatAmount.mockResolvedValue(successfulResponse('1200', '10.50'));
    const { result } = renderHook(() => useSatFiatAmount({ defaultCurrency: 'USD' }));

    await act(async () => {
      await result.current.handleFiatAmountChange('10.50');
    });

    expect(mockGetBtcSatAmount).toHaveBeenCalledWith({ source: 'fiat', amount: '10.50' });
    expect(result.current.inputSatsText).toBe('1200');
    expect(result.current.inputFiatText).toBe('10.50');
    expect(result.current.amountSat).toBe(1200);
  });

  it('ignores stale conversion responses', async () => {
    let resolveFirst!: (response: TResponse) => void;
    mockGetBtcSatAmount
      .mockReturnValueOnce(new Promise<TResponse>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce(successfulResponse('2000', '20.00'));
    const { result } = renderHook(() => useSatFiatAmount({ defaultCurrency: 'USD' }));

    act(() => {
      void result.current.handleSatsAmountChange('1000');
    });
    await act(async () => {
      await result.current.handleSatsAmountChange('2000');
    });
    await act(async () => {
      resolveFirst(successfulResponse('1000', '10.00'));
      await Promise.resolve();
    });

    expect(result.current.inputSatsText).toBe('2000');
    expect(result.current.inputFiatText).toBe('20.00');
    expect(result.current.amountSat).toBe(2000);
  });

  it('invalidates an in-flight conversion when reset', async () => {
    let resolveConversion!: (response: TResponse) => void;
    mockGetBtcSatAmount.mockReturnValue(new Promise<TResponse>((resolve) => {
      resolveConversion = resolve;
    }));
    const { result } = renderHook(() => useSatFiatAmount({ defaultCurrency: 'USD' }));

    act(() => {
      void result.current.handleSatsAmountChange('1200');
    });
    act(() => {
      result.current.resetAmountInput();
    });
    await act(async () => {
      resolveConversion(successfulResponse('1200', '10.50'));
      await Promise.resolve();
    });

    expect(result.current.inputSatsText).toBe('');
    expect(result.current.inputFiatText).toBe('');
    expect(result.current.amountSat).toBeUndefined();
  });
});
