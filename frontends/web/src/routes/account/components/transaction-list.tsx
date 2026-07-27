// SPDX-License-Identifier: Apache-2.0

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Transaction } from '@/components/transactions/transaction';
import style from '../account.module.css';

export type TTransactionListItem = accountApi.TTransaction & {
  statusProgress?: number;
  statusText?: string;
  statusTextShort?: string;
};

type TransactionListProps = {
  transactionSuccess: boolean;
  filteredTransactions: TTransactionListItem[];
  debouncedSearchTerm: string;
  onShowDetail: (internalID: accountApi.TTransaction['internalID']) => void;
};

export const TransactionList = memo<TransactionListProps>(({
  transactionSuccess,
  filteredTransactions,
  debouncedSearchTerm,
  onShowDetail,
}) => {
  const { t } = useTranslation();

  if (!transactionSuccess) {
    return null;
  }

  const hasSearchTerm = debouncedSearchTerm.trim().length > 0;
  const hasTransactions = filteredTransactions.length > 0;

  if (hasTransactions) {
    return (
      <>
        {filteredTransactions.map(tx => (
          <Transaction
            key={tx.internalID}
            onShowDetail={onShowDetail}
            {...tx}
          />
        ))}
      </>
    );
  }

  if (hasSearchTerm) {
    return (
      <p className={style.emptyTransactions}>
        {t('transaction.no-results', { searchTerm: debouncedSearchTerm })}
      </p>
    );
  } else {
    return (
      <p className={style.emptyTransactions}>
        {t('transactions.placeholder')}
      </p>
    );
  }
});
