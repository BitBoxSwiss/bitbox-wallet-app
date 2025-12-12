// SPDX-License-Identifier: Apache-2.0

import { TransactionSkeleton } from '@/components/transactions/transaction-skeleton';
import style from './account.module.css';

export const TransactionHistorySkeleton = () => {
  return (
    <div className={style.txHistorySkeleton}>
      {Array.from({ length: 5 }).map((_, index) => (
        <TransactionSkeleton key={index} />
      ))}
    </div>
  );
};
