// SPDX-License-Identifier: Apache-2.0

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Transaction } from '@/components/transactions/transaction';
import style from '../account.module.css';

type TransactionListProps = {
  coinCode: accountApi.CoinCode;
  transactionSuccess: boolean;
  filteredTransactions: accountApi.TTransaction[];
  debouncedSearchTerm: string;
  onShowDetail: (internalID: accountApi.TTransaction['internalID']) => void;
  onSpeedUp: (internalID: accountApi.TTransaction['internalID']) => void;
};

export const TransactionList = memo<TransactionListProps>(({
  coinCode,
  transactionSuccess,
  filteredTransactions,
  debouncedSearchTerm,
  onShowDetail,
  onSpeedUp,
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
            coinCode={coinCode}
            onShowDetail={onShowDetail}
            onSpeedUp={onSpeedUp}
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
