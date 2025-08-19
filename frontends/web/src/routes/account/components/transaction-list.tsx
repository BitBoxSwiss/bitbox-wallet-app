/**
 * Copyright 2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Transaction } from '@/components/transactions/transaction';
import style from '../account.module.css';

type TransactionListProps = {
  transactionSuccess: boolean;
  filteredTransactions: accountApi.ITransaction[];
  debouncedSearchTerm: string;
  onShowDetail: (internalID: accountApi.ITransaction['internalID']) => void;
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