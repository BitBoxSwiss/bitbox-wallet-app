// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import type { ContextType, ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import type { TTransaction } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { emptyFilters, matchesFilters, TTransactionFilters, useTransactionFilters } from './use-transaction-filters';

const makeTx = (overrides: Partial<TTransaction> = {}): TTransaction => ({
  addresses: ['addr1'],
  amount: { amount: '0.5', conversions: { USD: '100.00' }, unit: 'BTC', estimated: false },
  amountAtTime: { amount: '0.5', conversions: { USD: '90.00' }, unit: 'BTC', estimated: false },
  fee: { amount: '0.0001', conversions: {}, unit: 'BTC', estimated: false },
  feeRateInfo: '',
  deductedAmountAtTime: { amount: '0.5001', conversions: { USD: '90.10' }, unit: 'BTC', estimated: false },
  gas: 0,
  nonce: null,
  internalID: 'id',
  note: '',
  numConfirmations: 6,
  numConfirmationsComplete: 6,
  size: 0,
  status: 'complete',
  time: '2026-07-10T12:00:00Z',
  type: 'receive',
  txID: 'txid',
  vsize: 0,
  weight: 0,
  ...overrides,
});

const filters = (overrides: Partial<TTransactionFilters>): TTransactionFilters => ({
  ...emptyFilters,
  ...overrides,
});

describe('matchesFilters', () => {
  it('matches everything with empty filters', () => {
    expect(matchesFilters(makeTx(), emptyFilters, 'USD')).toBe(true);
  });

  describe('date range', () => {
    it('includes tx on the from-date boundary (00:00 local)', () => {
      const tx = makeTx({ time: '2026-07-10T00:00:00' });
      expect(matchesFilters(tx, filters({ fromDate: '2026-07-10' }), 'USD')).toBe(true);
    });

    it('excludes tx before the from-date', () => {
      const tx = makeTx({ time: '2026-07-09T23:59:00' });
      expect(matchesFilters(tx, filters({ fromDate: '2026-07-10' }), 'USD')).toBe(false);
    });

    it('includes tx late on the to-date (23:59 local)', () => {
      const tx = makeTx({ time: '2026-07-10T23:59:00' });
      expect(matchesFilters(tx, filters({ toDate: '2026-07-10' }), 'USD')).toBe(true);
    });

    it('excludes tx after the to-date', () => {
      const tx = makeTx({ time: '2026-07-11T00:00:01' });
      expect(matchesFilters(tx, filters({ toDate: '2026-07-10' }), 'USD')).toBe(false);
    });

    it('treats pending tx (time null) as now', () => {
      const tx = makeTx({ time: null });
      const now = new Date('2026-07-15T10:00:00');
      expect(matchesFilters(tx, filters({ fromDate: '2026-07-14', toDate: '2026-07-15' }), 'USD', now)).toBe(true);
      expect(matchesFilters(tx, filters({ toDate: '2026-07-10' }), 'USD', now)).toBe(false);
    });
  });

  describe('type', () => {
    it('matches exact type and rejects others', () => {
      expect(matchesFilters(makeTx({ type: 'send' }), filters({ type: 'send' }), 'USD')).toBe(true);
      expect(matchesFilters(makeTx({ type: 'receive' }), filters({ type: 'send' }), 'USD')).toBe(false);
      expect(matchesFilters(makeTx({ type: 'send_to_self' }), filters({ type: 'send_to_self' }), 'USD')).toBe(true);
    });
  });

  describe('amount in coin', () => {
    it('applies inclusive min/max bounds on the displayed amount', () => {
      const tx = makeTx(); // receive, amountAtTime 0.5
      expect(matchesFilters(tx, filters({ amountMin: '0.5' }), 'USD')).toBe(true);
      expect(matchesFilters(tx, filters({ amountMin: '0.6' }), 'USD')).toBe(false);
      expect(matchesFilters(tx, filters({ amountMax: '0.5' }), 'USD')).toBe(true);
      expect(matchesFilters(tx, filters({ amountMax: '0.4' }), 'USD')).toBe(false);
    });

    it('uses deducted amount for sends, matching what the list displays', () => {
      const tx = makeTx({ type: 'send' }); // deductedAmountAtTime 0.5001
      expect(matchesFilters(tx, filters({ amountMin: '0.5001' }), 'USD')).toBe(true);
      expect(matchesFilters(tx, filters({ amountMax: '0.5' }), 'USD')).toBe(false);
    });

    it('uses deducted amount for send_to_self', () => {
      expect(matchesFilters(makeTx({ type: 'send_to_self' }), filters({ amountMin: '0.5001' }), 'USD')).toBe(true);
    });

    it('compares negative amounts by absolute value', () => {
      const tx = makeTx({ amountAtTime: { amount: '-0.5', conversions: { USD: '90.00' }, unit: 'BTC', estimated: false } });
      expect(matchesFilters(tx, filters({ amountMin: '0.4', amountMax: '0.6' }), 'USD')).toBe(true);
    });
  });

  describe('amount in fiat', () => {
    it('compares against the historical fiat value', () => {
      const tx = makeTx(); // amountAtTime USD 90.00
      expect(matchesFilters(tx, filters({ amountUnit: 'fiat', amountMin: '90' }), 'USD')).toBe(true);
      expect(matchesFilters(tx, filters({ amountUnit: 'fiat', amountMin: '91' }), 'USD')).toBe(false);
    });

    it('parses thousand separators in conversion strings', () => {
      const tx = makeTx({
        amountAtTime: { amount: '20', conversions: { USD: '1\'234.56' }, unit: 'BTC', estimated: false },
      });
      expect(matchesFilters(tx, filters({ amountUnit: 'fiat', amountMin: '1234', amountMax: '1235' }), 'USD')).toBe(true);
    });

    it('excludes tx with missing or empty conversion when fiat filter active', () => {
      const noConversions = makeTx({ amountAtTime: { amount: '0.5', unit: 'BTC', estimated: false } });
      const emptyConversion = makeTx({
        amountAtTime: { amount: '0.5', conversions: { USD: '' }, unit: 'BTC', estimated: false },
      });
      expect(matchesFilters(noConversions, filters({ amountUnit: 'fiat', amountMin: '1' }), 'USD')).toBe(false);
      expect(matchesFilters(emptyConversion, filters({ amountUnit: 'fiat', amountMin: '1' }), 'USD')).toBe(false);
      // but they still match when no amount filter is set
      expect(matchesFilters(noConversions, filters({ amountUnit: 'fiat' }), 'USD')).toBe(true);
    });
  });

  it('combines all criteria with AND', () => {
    const tx = makeTx({ type: 'send', time: '2026-07-10T12:00:00' });
    const combined = filters({ fromDate: '2026-07-01', toDate: '2026-07-31', type: 'send', amountMin: '0.5', amountMax: '0.6' });
    expect(matchesFilters(tx, combined, 'USD')).toBe(true);
    expect(matchesFilters(tx, { ...combined, type: 'receive' }, 'USD')).toBe(false);
  });
});

const wrapper = ({ children }: { children: ReactNode }) => createElement(
  RatesContext.Provider,
  { value: { defaultCurrency: 'USD' } as ContextType<typeof RatesContext> },
  children,
);

describe('useTransactionFilters', () => {
  it('starts inactive and becomes active when a filter is set', () => {
    const { result } = renderHook(() => useTransactionFilters(), { wrapper });
    expect(result.current.isActive).toBe(false);
    act(() => result.current.setFilters({ ...result.current.filters, type: 'send' }));
    expect(result.current.isActive).toBe(true);
  });

  it('clearFilters resets to empty', () => {
    const { result } = renderHook(() => useTransactionFilters(), { wrapper });
    act(() => result.current.setFilters({ ...result.current.filters, fromDate: '2026-07-01', amountMin: '1' }));
    act(() => result.current.clearFilters());
    expect(result.current.isActive).toBe(false);
    expect(result.current.filters.fromDate).toBe('');
    expect(result.current.filters.amountMin).toBe('');
  });

  it('matches delegates to matchesFilters', () => {
    // sanity: matches() delegates to matchesFilters with the current fiat
    const { result } = renderHook(() => useTransactionFilters(), { wrapper });
    expect(result.current.matches(makeTx())).toBe(true);
    act(() => result.current.setFilters({ ...result.current.filters, type: 'send' }));
    expect(result.current.matches(makeTx())).toBe(false); // makeTx is receive
  });

  it('applies amount bounds only after the debounce delay', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTransactionFilters(), { wrapper });
      // amountMin '1' excludes makeTx's displayed amount of 0.5
      act(() => result.current.setFilters({ ...result.current.filters, amountMin: '1' }));
      // debounced value not yet applied
      expect(result.current.matches(makeTx())).toBe(true);
      act(() => vi.advanceTimersByTime(200));
      expect(result.current.matches(makeTx())).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
