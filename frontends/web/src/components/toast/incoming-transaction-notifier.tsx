// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getTransactionList, TAccount } from '@/api/account';
import { syncdone } from '@/api/accountsync';
import { syncNewTxs } from '@/api/transactions';
import { notifyUser } from '@/api/system';
import { ArrowFloorDownBlue } from '@/components/icon';
import { useToast } from '@/contexts/toast-context';

type TIncomingTransactionNotifierProps = {
  activeAccounts: TAccount[];
};

export const IncomingTransactionNotifier = ({ activeAccounts }: TIncomingTransactionNotifierProps) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const shownIncomingTxIDsRef = useRef<Record<string, boolean>>({});
  const initializedAccountsRef = useRef<Record<string, boolean>>({});
  const seedingAccountsRef = useRef<Record<string, boolean>>({});

  const markIncomingAsSeen = useCallback((accountCode: string, txID: string) => {
    shownIncomingTxIDsRef.current[`${accountCode}:${txID}`] = true;
  }, []);

  const showIncomingTxToast = useCallback((amount: string, unit: string) => {
    showToast({
      icon: <ArrowFloorDownBlue />,
      message: t('notification.incomingTxToast', {
        amount,
        unit,
      }),
      type: 'info',
    });
  }, [showToast, t]);

  const seedIncomingTransactionsForAccount = useCallback(async (account: TAccount) => {
    if (initializedAccountsRef.current[account.code] || seedingAccountsRef.current[account.code]) {
      return;
    }

    seedingAccountsRef.current[account.code] = true;
    try {
      const transactions = await getTransactionList(account.code);
      if (!transactions.success) {
        return;
      }
      transactions.list
        .filter(tx => tx.type === 'receive')
        .forEach(tx => markIncomingAsSeen(account.code, tx.internalID));
      initializedAccountsRef.current[account.code] = true;
    } finally {
      seedingAccountsRef.current[account.code] = false;
    }
  }, [markIncomingAsSeen]);

  // Seed known incoming transactions for active accounts so we only toast truly new ones.
  useEffect(() => {
    void Promise.all(activeAccounts.map(account => seedIncomingTransactionsForAccount(account)));
  }, [activeAccounts, seedIncomingTransactionsForAccount]);

  useEffect(() => {
    return syncNewTxs((meta) => {
      notifyUser(t('notification.newTxs', {
        count: meta.count,
        accountName: meta.accountName,
      }));
    });
  }, [t]);

  const detectAndToastIncomingForAccount = useCallback(async (account: TAccount) => {
    if (!initializedAccountsRef.current[account.code]) {
      return;
    }

    const transactions = await getTransactionList(account.code);
    if (!transactions.success) {
      return;
    }

    // New transactions are sorted to the front. Check only the latest window.
    const recentTransactions = transactions.list.slice(0, 30);
    recentTransactions
      .filter(tx => tx.type === 'receive')
      .reverse()
      .forEach((tx) => {
        const txKey = `${account.code}:${tx.internalID}`;
        if (shownIncomingTxIDsRef.current[txKey]) {
          return;
        }
        markIncomingAsSeen(account.code, tx.internalID);
        showIncomingTxToast(tx.amount.amount, tx.amount.unit);
      });
  }, [markIncomingAsSeen, showIncomingTxToast]);

  useEffect(() => {
    const unsubscribers = activeAccounts.map((account) => {
      return syncdone(account.code, () => {
        void (async () => {
          await seedIncomingTransactionsForAccount(account);
          await detectAndToastIncomingForAccount(account);
        })();
      });
    });
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [activeAccounts, detectAndToastIncomingForAccount, seedIncomingTransactionsForAccount]);

  return null;
};
