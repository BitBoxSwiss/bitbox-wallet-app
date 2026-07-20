// SPDX-License-Identifier: Apache-2.0

import type { Fiat, TTransaction, TTransactionType } from '@/api/account';

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

export const emptyFilters: TTransactionFilters = {
  fromDate: '',
  toDate: '',
  type: 'all',
  amountMin: '',
  amountMax: '',
  amountUnit: 'coin',
};

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
