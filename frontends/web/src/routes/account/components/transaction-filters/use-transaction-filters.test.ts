// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { emptyFilters, useTransactionFilters } from './use-transaction-filters';

describe('useTransactionFilters', () => {
  it('starts inactive and becomes active when a filter is applied', () => {
    const { result } = renderHook(() => useTransactionFilters());
    expect(result.current.isActive).toBe(false);

    act(() => result.current.setFilters({ ...result.current.filters, type: 'send' }));

    expect(result.current.isActive).toBe(true);
    expect(result.current.filters.type).toBe('send');
  });

  it('clearFilters resets to empty', () => {
    const { result } = renderHook(() => useTransactionFilters());
    act(() => result.current.setFilters({
      ...result.current.filters, fromDate: '2026-07-01', type: 'send',
    }));
    act(() => result.current.clearFilters());

    expect(result.current.isActive).toBe(false);
    expect(result.current.filters).toEqual(emptyFilters);
  });
});
