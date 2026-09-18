// SPDX-License-Identifier: Apache-2.0

import { act } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from '@/api/account';
import { transactionsChanged } from '@/api/accountsync';
import { useAccountData } from './use-account-data';

vi.mock('@/api/accountsync', () => ({
  syncdone: vi.fn(() => () => {}),
  transactionsChanged: vi.fn(() => () => {}),
}));

const deferred = <T, >() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

const amount: accountApi.TAmountWithConversions = {
  amount: '100000000',
  estimated: false,
  unit: 'BTC',
};

const balance: accountApi.TBalance = {
  available: amount,
  hasAvailable: true,
  hasIncoming: false,
  incoming: { ...amount, amount: '0' },
};

const transactions: accountApi.TTransactions = {
  list: [],
  success: true,
};

const status: accountApi.TStatus = {
  disabled: false,
  fatalError: false,
  offlineError: null,
  synced: true,
};

describe('useAccountData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps cached data visible while revalidating after a remount', async () => {
    const getBalance = vi.spyOn(accountApi, 'getBalance').mockResolvedValue({
      balance,
      success: true,
    });
    const getTransactionList = vi.spyOn(accountApi, 'getTransactionList').mockResolvedValue(transactions);

    const firstRender = renderHook(() => useAccountData('account-cache-test', status, 'default'));

    expect(firstRender.result.current.balance).toBeUndefined();
    expect(firstRender.result.current.transactions).toBeUndefined();

    await waitFor(() => {
      expect(firstRender.result.current.balance).toBe(balance);
      expect(firstRender.result.current.transactions).toBe(transactions);
    });

    const updatedTransactions: accountApi.TTransactions = {
      list: [],
      success: true,
    };
    const subscriptionCallback = vi.mocked(transactionsChanged).mock.calls[0]?.[1];
    act(() => subscriptionCallback?.(updatedTransactions));
    firstRender.unmount();

    const pendingBalance = deferred<Awaited<ReturnType<typeof accountApi.getBalance>>>();
    const pendingTransactions = deferred<Awaited<ReturnType<typeof accountApi.getTransactionList>>>();
    getBalance.mockReturnValue(pendingBalance.promise);
    getTransactionList.mockReturnValue(pendingTransactions.promise);

    const secondRender = renderHook(() => useAccountData('account-cache-test', status, 'default'));

    expect(secondRender.result.current.balance).toBe(balance);
    expect(secondRender.result.current.balanceShouldFade).toBe(false);
    expect(secondRender.result.current.transactions).toBe(updatedTransactions);
    expect(secondRender.result.current.transactionsShouldFade).toBe(false);
    expect(getBalance).toHaveBeenCalledTimes(2);
    expect(getTransactionList).toHaveBeenCalledTimes(2);
  });
});
