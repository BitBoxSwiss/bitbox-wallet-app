// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TTransactionStatus } from '@/api/account';
import { ProgressRing } from '@/components/progressRing/progressRing';
import styles from './tx-detail-dialog.module.css';

type TProps = {
  status: TTransactionStatus;
  numConfirmations: number;
  numConfirmationsComplete: number;
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
    <div className={styles.status}>
      <ProgressRing
        className="m-right-quarter"
        width={14}
        value={progress}
        isComplete={isComplete}
      />
      <span>
        {statusText}{status === 'pending' && (
          <span>
            {`(${numConfirmations}/${numConfirmationsComplete})`}
          </span>
        )}
      </span>
    </div>
  );
};
