// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { CoinCode, TAmountWithConversions, TTransactionStatus, TTransactionType, TTransaction } from '@/api/account';
import { useMediaQuery } from '@/hooks/mediaquery';
import { CloseXDark, InfoBlue, Loupe } from '@/components/icon/icon';
import { parseTimeLong, parseTimeShort } from '@/utils/date';
import { ProgressRing } from '@/components/progressRing/progressRing';
import { AppContext } from '@/contexts/AppContext';
import { AmountWithUnit } from '../amount/amount-with-unit';
import { ConversionAmount } from '@/components/amount/conversion-amount';
import { Arrow } from './components/arrows';
import { getTxSign } from '@/utils/transaction';
import { RBF_PENDING_THRESHOLD_MS, shouldShowSpeedUpPopup } from './speed-up';
import styles from './transaction.module.css';

type TTransactionProps = TTransaction & {
  coinCode: CoinCode;
  onShowDetail: (internalID: TTransaction['internalID']) => void;
  onSpeedUp: (internalID: TTransaction['internalID']) => void;
};

export const Transaction = ({
  addresses,
  amountAtTime,
  coinCode,
  deductedAmountAtTime,
  onShowDetail,
  onSpeedUp,
  internalID,
  note,
  numConfirmations,
  numConfirmationsComplete,
  status,
  time,
  type,
}: TTransactionProps) => {
  const { t } = useTranslation();
  const { isTesting } = useContext(AppContext);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [speedUpPromptDismissed, setSpeedUpPromptDismissed] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  const parsedBroadcastTime = time ? Date.parse(time) : Number.NaN;
  const shouldTrackPendingThreshold =
    !isTesting &&
    !speedUpPromptDismissed &&
    !Number.isNaN(parsedBroadcastTime) &&
    status === 'pending' &&
    numConfirmations === 0 &&
    (type === 'send' || type === 'send_to_self');

  useEffect(() => {
    if (!shouldTrackPendingThreshold) {
      return;
    }
    const thresholdTime = parsedBroadcastTime + RBF_PENDING_THRESHOLD_MS;
    if (now >= thresholdTime) {
      return;
    }
    const timeout = window.setTimeout(() => setNow(Date.now()), thresholdTime - now);
    return () => window.clearTimeout(timeout);
  }, [now, parsedBroadcastTime, shouldTrackPendingThreshold]);

  const showSpeedUpPrompt = !speedUpPromptDismissed && shouldShowSpeedUpPopup({
    coinCode,
    isTesting,
    numConfirmations,
    status,
    time,
    type,
    now,
  });
  const txCardClassName = [
    styles.txCard,
    showSpeedUpPrompt ? styles.txCardWithSpeedUp : null
  ].filter(Boolean).join(' ');

  return (
    <section className={styles.tx}
      onClick={() => {
        if (isMobile) {
          onShowDetail(internalID);
        }
      }}>
      <div className={txCardClassName}>
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
        {showSpeedUpPrompt && (
          <div
            className={styles.speedUpPopup}
            onClick={event => event.stopPropagation()}>
            <div className={styles.speedUpPopupHeader}>
              <InfoBlue className={styles.speedUpPopupInfoIcon} />
              <p className={styles.speedUpPopupText}>{t('transaction.speedUpPrompt.message')}</p>
            </div>
            <button
              className={styles.speedUpPopupClose}
              onClick={event => {
                event.stopPropagation();
                setSpeedUpPromptDismissed(true);
              }}
              aria-label={t('generic.close')}
              type="button">
              <CloseXDark className={styles.speedUpPopupCloseIcon} />
            </button>
            <button
              className={styles.speedUpPopupLink}
              onClick={event => {
                event.stopPropagation();
                onSpeedUp(internalID);
              }}
              type="button">
              <span className={styles.speedUpPopupLinkIcon} aria-hidden />
              {t('transaction.speedUpPrompt.action')}
            </button>
          </div>
        )}
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
        <TxDate time={time} />
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

const TxDate = ({
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
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (type === 'send_to_self') {
    const labelKey = status === 'failed'
      ? 'transaction.tx.send_to_self_failed'
      : 'transaction.tx.send_to_self';
    return (
      <span className={styles.txNoteWithAddress}>
        <span className={styles.txType}>
          <Trans
            i18nKey={labelKey}
            components={{
              amount: (
                <AmountWithUnit
                  amount={amount}
                  unitClassName={styles.txUnit}
                />
              ),
            }}
          />
        </span>
        {' '}
        <AddressList values={addresses} />
      </span>
    );
  }

  const label = isMobile
    ? (type === 'receive' ? t('generic.received') : t('generic.sent'))
    : (type === 'receive'
      ? t('transaction.tx.receive', { context: status })
      : t('transaction.tx.send', { context: status })
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
