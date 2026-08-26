// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState } from 'react';
import type { TTransactionType } from '@/api/account';
import { useDebounce } from '@/hooks/debounce';

export type TTransactionTypeFilter = 'all' | TTransactionType;
export type TAmountUnitFilter = 'coin' | 'fiat';
export type TSortByFilter = 'date' | 'amount' | 'type';
export type TSortDirFilter = 'asc' | 'desc';

export type TTransactionFilters = {
  fromDate: string; // 'YYYY-MM-DD' or '' when unset
  toDate: string;
  type: TTransactionTypeFilter;
  amountMin: string;
  amountMax: string;
  amountUnit: TAmountUnitFilter;
  sortBy: TSortByFilter;
  sortDir: TSortDirFilter;
};

export const emptyFilters = Object.freeze<TTransactionFilters>({
  fromDate: '',
  toDate: '',
  type: 'all',
  amountMin: '',
  amountMax: '',
  amountUnit: 'fiat',
  sortBy: 'date',
  sortDir: 'desc',
});

export const useTransactionFilters = () => {
  const [filters, setFilters] = useState<TTransactionFilters>(emptyFilters);
  // Debounce free-text amount inputs so typing doesn't request per keystroke.
  const debouncedAmountMin = useDebounce(filters.amountMin, 200);
  const debouncedAmountMax = useDebounce(filters.amountMax, 200);

  const appliedFilters = useMemo(() => ({
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    type: filters.type,
    amountUnit: filters.amountUnit,
    amountMin: debouncedAmountMin,
    amountMax: debouncedAmountMax,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  }), [filters.fromDate, filters.toDate, filters.type, filters.amountUnit, debouncedAmountMin, debouncedAmountMax, filters.sortBy, filters.sortDir]);

  const clearFilters = useCallback(() => setFilters(emptyFilters), []);

  // Derived from the applied (debounced) filters so it stays in sync with
  // the backend request: e.g. right after clearing an amount filter, the list is still
  // filtered with the old value for the debounce duration, and reporting
  // "inactive" during that window would show the wrong empty state.
  const isActive = appliedFilters.fromDate !== ''
    || appliedFilters.toDate !== ''
    || appliedFilters.type !== 'all'
    || appliedFilters.amountMin.trim() !== ''
    || appliedFilters.amountMax.trim() !== '';

  return { filters, appliedFilters, setFilters, clearFilters, isActive };
};
