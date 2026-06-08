// SPDX-License-Identifier: Apache-2.0

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
  amountSign: string;
  amountAtTimeSign: string;
};

type StatusAndSignProps = {
  status: TTransactionStatus;
  numConfirmations: number;
  numConfirmationsComplete: number;
  type: TTransactionType;
};

type AmountAndDateProps = {
  amountSign: string;
  amountAtTimeSign: string;
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
  amountSign,
  amountAtTimeSign,
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
        amountSign={amountSign}
        amountAtTimeSign={amountAtTimeSign}
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
      return t('transaction.details.sentToSelf');
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
  amountSign,
  amountAtTimeSign,
  amount,
  transactionInfo,
  time
}: AmountAndDateProps) => {
  return (
    <div className={styles.amountContainer}>
      <span className={styles.amount}>
        {amountSign}<AmountWithUnit amount={amount} unitClassName={styles.headerAmountUnit} />
      </span>
      <span className={styles.amountFiat}>
        {amountAtTimeSign}<AmountWithUnit amount={transactionInfo.amountAtTime} convertToFiat unitClassName={styles.headerFiatUnit} />
      </span>

      <span className={styles.date}>
        {time ? parseTimeLongWithYear(time, i18n.language) : '---'}
      </span>
    </div>
  );
};