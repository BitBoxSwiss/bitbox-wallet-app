// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import * as accountApi from '@/api/account';
import { syncdone, transactionsChanged } from '@/api/accountsync';
import type { BtcUnit } from '@/api/coins';
import { useMountedRef } from '@/hooks/mount';

type TCachedAccountData = {
  balance?: accountApi.TBalance;
  btcUnit: BtcUnit | undefined;
  transactions?: accountApi.TTransactions;
};

const accountDataCache = new Map<accountApi.AccountCode, TCachedAccountData>();

const getCachedData = (
  code: accountApi.AccountCode,
  btcUnit: BtcUnit | undefined,
) => {
  const cached = accountDataCache.get(code);
  return cached?.btcUnit === btcUnit ? cached : undefined;
};

const updateCache = (
  code: accountApi.AccountCode,
  btcUnit: BtcUnit | undefined,
  data: Partial<Pick<TCachedAccountData, 'balance' | 'transactions'>>,
) => {
  const cached = accountDataCache.get(code);
  accountDataCache.set(code, {
    ...(cached?.btcUnit === btcUnit ? cached : {}),
    ...data,
    btcUnit,
  });
};

export const useAccountData = (
  code: accountApi.AccountCode,
  status: accountApi.TStatus | undefined,
  btcUnit: BtcUnit | undefined,
) => {
  const initialCache = useRef(getCachedData(code, btcUnit));
  const [balance, setBalance] = useState(initialCache.current?.balance);
  const [balanceShouldFade, setBalanceShouldFade] = useState(balance === undefined);
  const [transactions, setTransactions] = useState(initialCache.current?.transactions);
  const [transactionsShouldFade, setTransactionsShouldFade] = useState(transactions === undefined);
  const mounted = useMountedRef();

  const updateBalance = useCallback((balance: accountApi.TBalance) => {
    updateCache(code, btcUnit, { balance });
    if (mounted.current) {
      setBalance(balance);
    }
  }, [btcUnit, code, mounted]);

  const updateTransactions = useCallback((transactions: accountApi.TTransactions) => {
    updateCache(code, btcUnit, { transactions });
    if (mounted.current) {
      setTransactions(transactions);
    }
  }, [btcUnit, code, mounted]);

  const onAccountChanged = useCallback((status: accountApi.TStatus | undefined) => {
    if (status === undefined || status.fatalError) {
      return;
    }
    if (status.synced && status.offlineError === null) {
      Promise.all([
        accountApi.getBalance(code).then(response => {
          if (response.success) {
            updateBalance(response.balance);
          }
        }),
        accountApi.getTransactionList(code).then(updateTransactions),
      ]).catch(console.error);
    } else {
      accountDataCache.delete(code);
      setBalance(undefined);
      setBalanceShouldFade(true);
      setTransactions(undefined);
      setTransactionsShouldFade(true);
    }
  }, [code, updateBalance, updateTransactions]);

  useEffect(() => {
    return syncdone(code, () => onAccountChanged(status));
  }, [code, onAccountChanged, status]);

  useEffect(() => {
    return transactionsChanged(code, updateTransactions);
  }, [code, updateTransactions]);

  useEffect(() => {
    onAccountChanged(status);
  }, [onAccountChanged, status]);

  return {
    balance,
    balanceShouldFade,
    transactions,
    transactionsShouldFade,
  };
};
