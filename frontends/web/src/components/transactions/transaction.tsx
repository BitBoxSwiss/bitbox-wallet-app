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
import type { TAmountWithConversions, TTransactionStatus, TTransactionType, TTransaction } from '@/api/account';
import { useMediaQuery } from '@/hooks/mediaquery';
import { Loupe } from '@/components/icon/icon';
import { parseTimeLong, parseTimeShort } from '@/utils/date';
import { ProgressRing } from '@/components/progressRing/progressRing';
import { Amount } from '@/components/amount/amount';
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
      <div className={styles.txContent}>
        <span className={styles.txIcon}>
          <Arrow status={status} type={type} />
        </span>
        <Status
          addresses={addresses}
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
          type="button">
          <Loupe className={styles.iconLoupe} />
        </button>
      </div>
    </section>
  );
};

type TStatus = {
  addresses: string[];
  note?: TTransaction['note'];
  numConfirmations: number;
  numConfirmationsComplete: number;
  status: TTransactionStatus;
  time?: string | null;
  type: TTransactionType;
};

const Status = ({
  addresses,
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
  const displayAmount = recv ? amount.amount : deductedAmount.amount;
  const displayUnit = recv ? amount.unit : deductedAmount.unit;
  const sign = displayAmount ? getTxSign(type) : '';

  return (
    <span className={`
      ${styles.txAmountsColumn || ''}
      ${styles[txTypeClass] || ''}
    `}>
      <span className={styles.txAmount}>
        {sign}
        <Amount
          amount={displayAmount}
          unit={displayUnit}
        />
        <span className={styles.txUnit}>
          {' '}
          {displayUnit}
        </span>
      </span>
      <ConversionAmount amount={amount} deductedAmount={deductedAmount} type={type} />
    </span>
  );
};

type TDateProps = {
  time: string | null;
};

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
  status: TTransactionStatus;
  type: TTransactionType;
};

const Addresses = ({
  addresses,
  status,
  type,
}: TAddresses) => {
  const { t } = useTranslation();
  const label = (
    type === 'receive'
      ? t('transaction.tx.receive', {
        context: status
      })
      : t('transaction.tx.send', {
        context: status
      })
    // send_to_self will currently show the send message
  );

  return (
    <span className={styles.txNoteWithAddress}>
      <span className={styles.txType}>
        {label}
      </span>
      {' '}
      <span className={styles.addresses}>
        {addresses[0]}
        {addresses.length > 1 && (
          <span>
            {' '}
            (+{addresses.length - 1})
          </span>
        )}
      </span>
    </span>
  );
};
