/**
 * Copyright 2024 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import type { TTransactionStatus } from '@/api/account';
import { ProgressRing } from '@/components/progressRing/progressRing';
import { TxDetail } from './detail';
import transactionStyle from '@/components/transactions/transactions.module.css';
import parentStyle from '@/components/transactions/transaction.module.css';

type TProps = {
  status: TTransactionStatus;
  numConfirmations: number;
  numConfirmationsComplete: number;
}

export const TxStatus = ({
  status,
  numConfirmations,
  numConfirmationsComplete,
}: TProps) => {
  const { t } = useTranslation();
  const statusText = t(`transaction.status.${status}`);
  const progress = numConfirmations < numConfirmationsComplete ? (numConfirmations / numConfirmationsComplete) * 100 : 100;
  const isComplete = numConfirmations >= numConfirmationsComplete;
  return (
    <div className={transactionStyle.status}>
      <span className={parentStyle.columnLabel}>
        {t('transaction.details.status')}:
      </span>
      <ProgressRing
        className="m-right-quarter"
        width={14}
        value={progress}
        isComplete={isComplete}
      />
      <span className={parentStyle.status}>{statusText}</span>
    </div>
  );
};

export const TxStatusDetail = ({
  status,
  numConfirmations,
  numConfirmationsComplete,
}: TProps) => {
  const { t } = useTranslation();
  const statusText = t(`transaction.status.${status}`);
  const progress = numConfirmations < numConfirmationsComplete ? (numConfirmations / numConfirmationsComplete) * 100 : 100;
  const isComplete = numConfirmations >= numConfirmationsComplete;
  return (
    <TxDetail label={t('transaction.details.status')}>
      <ProgressRing
        className="m-right-quarter"
        width={14}
        value={progress}
        isComplete={isComplete}
      />
      <span className={parentStyle.status}>
        {statusText}{status === 'pending' && <span> {`(${numConfirmations}/${numConfirmationsComplete})`}</span>}
      </span>
    </TxDetail>
  );
};
