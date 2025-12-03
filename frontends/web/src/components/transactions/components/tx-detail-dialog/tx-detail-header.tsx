
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

import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Arrow } from '@/components/transactions/components/arrows';
import { TxStatusDetail } from '@/components/transactions/components/tx-detail-dialog/status';
import { TTransactionStatus, TTransactionType, TAmountWithConversions, TTransaction } from '@/api/account';
import { i18n } from '@/i18n/i18n';
import { parseTimeLongWithYear } from '@/utils/date';
import { useTranslation } from 'react-i18next';
import styles from './tx-detail-dialog.module.css';

type TxDetailHeaderProps = {
  status: TTransactionStatus;
  numConfirmations: number;
  numConfirmationsComplete: number;
  type: TTransactionType;
  amount: TAmountWithConversions;
  transactionInfo: TTransaction;
  time: string | null;
  displayedSign: string;
};

type StatusAndSignProps = {
  status: TTransactionStatus;
  numConfirmations: number;
  numConfirmationsComplete: number;
  type: TTransactionType;
};

type AmountAndDateProps = {
  displayedSign: string;
  amount: TAmountWithConversions;
  transactionInfo: TTransaction;
  time: string | null;
};

export const TxDetailHeader = ({
  status,
  numConfirmations,
  numConfirmationsComplete,
  type,
  amount,
  transactionInfo,
  time,
  displayedSign,
}: TxDetailHeaderProps) => {
  return (
    <div className={styles.header}>
      <StatusAndSign
        numConfirmations={numConfirmations}
        numConfirmationsComplete={numConfirmationsComplete}
        status={status}
        type={type}
      />
      <AmountAndDate
        displayedSign={displayedSign}
        amount={amount}
        transactionInfo={transactionInfo}
        time={time}
      />
    </div>
  );
};


const StatusAndSign = ({
  status,
  numConfirmations,
  numConfirmationsComplete,
  type,
}: StatusAndSignProps) => {
  const { t } = useTranslation();
  const fromSignToText = () => {
    switch (type) {
    case 'send':
      return t('generic.sent');
    case 'receive':
      return t('generic.received');
    case 'send_to_self':
      return t('transaction.details.sendToSelf');
    }
  };

  return (
    <div className={styles.statusContainer}>
      <TxStatusDetail
        status={status}
        numConfirmations={numConfirmations}
        numConfirmationsComplete={numConfirmationsComplete}
      />
      <div className={styles.transferDirection}>
        <Arrow
          status={status}
          type={type}
        />
        <span>{fromSignToText()}</span>
      </div>
    </div>
  );
};

const AmountAndDate = ({
  displayedSign,
  amount,
  transactionInfo,
  time
}: AmountAndDateProps) => {
  return (
    <div className={styles.amountContainer}>
      <span className={styles.amount}>
        {displayedSign}<AmountWithUnit amount={amount} unitClassName={styles.headerAmountUnit} />
      </span>
      <span className={styles.amountFiat}>{displayedSign}<AmountWithUnit amount={transactionInfo.amountAtTime} convertToFiat unitClassName={styles.headerFiatUnit} />
      </span>

      <span className={styles.date}>
        {time ? parseTimeLongWithYear(time, i18n.language) : '---'}
      </span>
    </div>
  );
};