// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useMemo, useState } from 'react';
import type { Fiat, TTransaction, TTransactionType } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { useDebounce } from '@/hooks/debounce';

export type TTransactionTypeFilter = 'all' | TTransactionType;
export type TAmountUnitFilter = 'coin' | 'fiat';

export type TTransactionFilters = {
  fromDate: string; // 'YYYY-MM-DD' or '' when unset
  toDate: string;
  type: TTransactionTypeFilter;
  amountMin: string;
  amountMax: string;
  amountUnit: TAmountUnitFilter;
};

export const emptyFilters = Object.freeze<TTransactionFilters>({
  fromDate: '',
  toDate: '',
  type: 'all',
  amountMin: '',
  amountMax: '',
  amountUnit: 'fiat',
});

// Inputs are expected to come from type="number" fields (canonical numeric
// strings), so this parsing is intentionally not locale-aware.
const parseBound = (input: string): number | null => {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

// Conversion strings are backend-formatted with ' as thousand separator,
// e.g. "1'234.56". Empty string means the rate was unavailable.
const parseConversion = (conversion: string | undefined): number | null => {
  if (!conversion) {
    return null;
  }
  const parsed = parseFloat(conversion.replace(/'/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
};

export const matchesFilters = (
  tx: TTransaction,
  filters: TTransactionFilters,
  fiat: Fiat,
  now: Date = new Date(),
): boolean => {
  if (filters.fromDate || filters.toDate) {
    // Pending transactions have no timestamp yet and count as "now".
    const txTime = tx.time ? new Date(tx.time).getTime() : now.getTime();
    if (filters.fromDate && txTime < new Date(`${filters.fromDate}T00:00:00`).getTime()) {
      return false;
    }
    if (filters.toDate && txTime > new Date(`${filters.toDate}T23:59:59.999`).getTime()) {
      return false;
    }
  }

  if (filters.type !== 'all' && tx.type !== filters.type) {
    return false;
  }

  const min = parseBound(filters.amountMin);
  const max = parseBound(filters.amountMax);
  if (min === null && max === null) {
    return true;
  }
  // Compare against the same value the transaction row displays.
  const displayAmount = tx.type === 'receive' ? tx.amountAtTime : tx.deductedAmountAtTime;
  const value = filters.amountUnit === 'coin'
    ? parseBound(displayAmount.amount)
    : parseConversion(displayAmount.conversions?.[fiat]);
  if (value === null) {
    return false;
  }
  const absValue = Math.abs(value);
  return (min === null || absValue >= min) && (max === null || absValue <= max);
};

export const useTransactionFilters = () => {
  const { defaultCurrency } = useContext(RatesContext);
  const [filters, setFilters] = useState<TTransactionFilters>(emptyFilters);
  // Debounce free-text amount inputs so typing doesn't re-filter per keystroke.
  const debouncedAmountMin = useDebounce(filters.amountMin, 200);
  const debouncedAmountMax = useDebounce(filters.amountMax, 200);

  const appliedFilters = useMemo(() => ({
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    type: filters.type,
    amountUnit: filters.amountUnit,
    amountMin: debouncedAmountMin,
    amountMax: debouncedAmountMax,
  }), [filters.fromDate, filters.toDate, filters.type, filters.amountUnit, debouncedAmountMin, debouncedAmountMax]);

  const matches = useCallback(
    (tx: TTransaction) => matchesFilters(tx, appliedFilters, defaultCurrency),
    [appliedFilters, defaultCurrency],
  );

  const clearFilters = useCallback(() => setFilters(emptyFilters), []);

  // Derived from the applied (debounced) filters so it stays in sync with
  // `matches`: e.g. right after clearing an amount filter, the list is still
  // filtered with the old value for the debounce duration, and reporting
  // "inactive" during that window would show the wrong empty state.
  const isActive = appliedFilters.fromDate !== ''
    || appliedFilters.toDate !== ''
    || appliedFilters.type !== 'all'
    || appliedFilters.amountMin.trim() !== ''
    || appliedFilters.amountMax.trim() !== '';

  return { filters, setFilters, clearFilters, isActive, matches };
};
