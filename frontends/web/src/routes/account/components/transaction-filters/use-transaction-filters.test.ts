// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { emptyFilters, useTransactionFilters } from './use-transaction-filters';

describe('useTransactionFilters', () => {
  it('starts inactive and becomes active when a filter is applied', () => {
    const { result } = renderHook(() => useTransactionFilters());
    expect(result.current.isActive).toBe(false);
    expect(result.current.appliedFilters).toEqual(emptyFilters);

    act(() => result.current.setFilters({ ...result.current.filters, type: 'send' }));

    expect(result.current.isActive).toBe(true);
    expect(result.current.appliedFilters.type).toBe('send');
  });

  it('clearFilters resets to empty', () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => result.current.setFilters({
      ...result.current.filters, fromDate: '2026-07-01', amountMin: '1', amountUnit: 'coin',
    }));
    act(() => result.current.clearFilters());

    expect(result.current.isActive).toBe(false);
    expect(result.current.filters).toEqual(emptyFilters);
    expect(result.current.appliedFilters).toEqual(emptyFilters);
  });

  it('applies amount bounds only after the debounce delay', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTransactionFilters());
      act(() => result.current.setFilters({ ...result.current.filters, amountMin: '100' }));

      expect(result.current.appliedFilters.amountMin).toBe('');
      expect(result.current.isActive).toBe(false);

      act(() => vi.advanceTimersByTime(200));

      expect(result.current.appliedFilters.amountMin).toBe('100');
      expect(result.current.isActive).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps isActive true until a debounced amount clear is applied', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTransactionFilters());
      act(() => result.current.setFilters({ ...result.current.filters, amountMin: '100' }));
      act(() => vi.advanceTimersByTime(200));
      expect(result.current.isActive).toBe(true);

      act(() => result.current.clearFilters());
      expect(result.current.isActive).toBe(true);
      expect(result.current.appliedFilters.amountMin).toBe('100');

      act(() => vi.advanceTimersByTime(200));
      expect(result.current.isActive).toBe(false);
      expect(result.current.appliedFilters.amountMin).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
