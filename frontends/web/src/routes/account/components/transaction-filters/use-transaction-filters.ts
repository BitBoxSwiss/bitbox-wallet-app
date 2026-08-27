// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from 'react';
import type { TTransactionType } from '@/api/account';

export type TTransactionTypeFilter = 'all' | TTransactionType;
export type TSortByFilter = 'date' | 'amount' | 'type';
export type TSortDirFilter = 'asc' | 'desc';

export type TTransactionFilters = {
  fromDate: string; // 'YYYY-MM-DD' or '' when unset
  toDate: string;
  type: TTransactionTypeFilter;
  sortBy: TSortByFilter;
  sortDir: TSortDirFilter;
};

export const emptyFilters = Object.freeze<TTransactionFilters>({
  fromDate: '',
  toDate: '',
  type: 'all',
  sortBy: 'date',
  sortDir: 'desc',
});

export const useTransactionFilters = () => {
  const [filters, setFilters] = useState<TTransactionFilters>(emptyFilters);

  const clearFilters = useCallback(() => setFilters(emptyFilters), []);

  const isActive = filters.fromDate !== ''
    || filters.toDate !== ''
    || filters.type !== 'all';

  return { filters, setFilters, clearFilters, isActive };
};
