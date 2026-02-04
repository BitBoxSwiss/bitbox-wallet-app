// SPDX-License-Identifier: Apache-2.0

import { Trans, useTranslation } from 'react-i18next';
import type { TAmountWithConversions, TTransactionStatus, TTransactionType, TTransaction } from '@/api/account';
import { useMediaQuery } from '@/hooks/mediaquery';
import { Loupe } from '@/components/icon/icon';
import { parseTimeLong, parseTimeShort } from '@/utils/date';
import { ProgressRing } from '@/components/progressRing/progressRing';
import { AmountWithUnit } from '../amount/amount-with-unit';
import { ConversionAmount } from '@/components/amount/conversion-amount';
import { Arrow } from './components/arrows';
import { getTxSign } from '@/utils/transaction';
import styles from './transaction.module.css';

type TTransactionProps = TTransaction & {
  onShowDetail: (internalID: TTransaction['internalID']) => void;
};

export const Transaction = ({
  addresses,
  amountAtTime,
  deductedAmountAtTime,
  onShowDetail,
  internalID,
  note,
  numConfirmations,
  numConfirmationsComplete,
  status,
  time,
  type,
}: TTransactionProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section className={styles.tx}
      onClick={() => {
        if (isMobile) {
          onShowDetail(internalID);
        }
      }}>
      <div className={styles.txContent} data-testid="transaction" data-tx-type={type}>
        <span className={styles.txIcon}>
          <Arrow status={status} type={type} />
        </span>
        <Status
          addresses={addresses}
          amount={amountAtTime}
          note={note}
          numConfirmations={numConfirmations}
          numConfirmationsComplete={numConfirmationsComplete}
          status={status}
          time={time}
          type={type}
        />
        <Amounts
          amount={amountAtTime}
          deductedAmount={deductedAmountAtTime}
          type={type}
        />
        <button
          className={styles.txShowDetailBtn}
          onClick={() => !isMobile && onShowDetail(internalID)}
          type="button"
          data-testid="tx-details-button">
          <Loupe className={styles.iconLoupe} data-testid="tx-details"/>
        </button>
      </div>
    </section>
  );
};

type TStatus = {
  addresses: string[];
  amount: TAmountWithConversions;
  note?: TTransaction['note'];
  numConfirmations: number;
  numConfirmationsComplete: number;
  status: TTransactionStatus;
  time?: string | null;
  type: TTransactionType;
};

const Status = ({
  addresses,
  amount,
  note,
  numConfirmations,
  numConfirmationsComplete,
  status,
  time,
  type,
}: TStatus) => {
  const { t } = useTranslation();
  const progress = numConfirmations < numConfirmationsComplete ? (numConfirmations / numConfirmationsComplete) * 100 : 100;
  const isComplete = numConfirmations >= numConfirmationsComplete;
  const showProgress = !isComplete || numConfirmations < numConfirmationsComplete;

  return (
    <span className={styles.txInfoColumn}>
      <span className={styles.txNote}>
        {note ? (
          <span className={styles.txNoteText}>
            {note}
          </span>
        ) : (
          <Addresses
            addresses={addresses}
            amount={amount}
            status={status}
            type={type}
          />
        )}
      </span>
      {(showProgress) && (
        <span className={styles.txProgress}>
          <span className={styles.txProgressTextLong}>
            {t(`transaction.status.${status}`, {
              context: type
            })}
          </span>
          <span className={styles.txProgressTextShort}>
            {t(`transaction.statusShort.${status}`, {
              context: type
            })}
          </span>
          <ProgressRing
            className={styles.iconProgress}
            width={18}
            value={progress}
            isComplete={isComplete}
          />
        </span>
      )}
      {' '}
      {isComplete && !showProgress && time && (
        <Date time={time} />
      )}
    </span>
  );
};

type TAmountsProps = {
  amount: TAmountWithConversions;
  deductedAmount: TAmountWithConversions;
  type: TTransactionType;
};

const Amounts = ({
  amount,
  deductedAmount,
  type,
}: TAmountsProps) => {
  const txTypeClass = `txAmount-${type}`;
  const recv = type === 'receive';
  const displayAmount = recv ? amount : deductedAmount;

  return (
    <span
      className={`
      ${styles.txAmountsColumn || ''}
      ${styles[txTypeClass] || ''}
    `}
      data-testid="tx-amounts"
    >
      <span className={styles.txAmount}>
        {displayAmount.amount !== '0' && getTxSign(type)}
        <AmountWithUnit
          amount={displayAmount}
          unitClassName={styles.txUnit}
        />
      </span>
      <ConversionAmount amount={amount} deductedAmount={deductedAmount} type={type} />
    </span>
  );
};

type TDateProps = {
  time: string | null;
};

type TAddressListProps = {
  values: string[];
};

const AddressList = ({ values }: TAddressListProps) => (
  <span className={styles.addresses}>
    {values[0]}
    {values.length > 1 && (
      <span>
        {' '}
        (+{values.length - 1})
      </span>
    )}
  </span>
);

const Date = ({
  time,
}: TDateProps) => {
  const { i18n } = useTranslation();
  if (!time) {
    return '---';
  }
  return (
    <span className={styles.txDate}>
      <span className={styles.txDateShort}>
        {parseTimeShort(time, i18n.language)}
      </span>
      <span className={styles.txDateLong}>
        {parseTimeLong(time, i18n.language)}
      </span>
    </span>
  );
};

type TAddresses = {
  addresses: TTransaction['addresses'];
  amount: TAmountWithConversions;
  status: TTransactionStatus;
  type: TTransactionType;
};

const Addresses = ({
  addresses,
  amount,
  status,
  type,
}: TAddresses) => {
  const { t } = useTranslation();

  if (type === 'send_to_self') {
    const labelKey = `transaction.tx.send_to_self_${status}`;
    return (
      <span className={styles.txNoteWithAddress}>
        <span className={styles.txType}>
          <Trans
            i18nKey={labelKey}
            components={[
              <AmountWithUnit
                amount={amount}
                unitClassName={styles.txUnit}
              />
            ]}
          />
        </span>
        {' '}
        <AddressList values={addresses} />
      </span>
    );
  }

  const label = (
    type === 'receive'
      ? t('transaction.tx.receive', {
        context: status
      })
      : t('transaction.tx.send', {
        context: status
      })
  );

  return (
    <span className={styles.txNoteWithAddress}>
      <span className={styles.txType}>
        {label}
      </span>
      {' '}
      <AddressList values={addresses} />
    </span>
  );
};
