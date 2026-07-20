// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TBitcoinDepositState, TLightningPayment } from '@/api/lightning';
import { useMediaQuery } from '@/hooks/mediaquery';
import { Loupe, WarningYellow } from '@/components/icon/icon';
import { parseTimeLong, parseTimeShort } from '@/utils/date';
import { ProgressRing } from '@/components/progressRing/progressRing';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { ConversionAmount } from '@/components/amount/conversion-amount';
import { Arrow } from '@/components/transactions/components/arrows';
import { getTxSign } from '@/utils/transaction';
import styles from '@/components/transactions/transaction.module.css';

type TProps = TLightningPayment & {
  onShowDetail: (id: TLightningPayment['id']) => void;
};

export const LightningPayment = ({
  amountAtTime,
  bitcoinDeposit,
  deductedAmountAtTime,
  description,
  id,
  onShowDetail,
  status,
  time,
  type,
}: TProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section
      className={styles.tx}
      onClick={() => {
        if (isMobile) {
          onShowDetail(id);
        }
      }}>
      <div className={styles.txContent} data-testid="transaction" data-tx-type={type}>
        <span className={styles.txIcon}>
          {bitcoinDeposit?.state === 'unclaimed'
            ? <WarningYellow />
            : <Arrow status={status} type={type} />}
        </span>
        <PaymentStatus
          bitcoinDeposit={bitcoinDeposit}
          description={description}
          status={status}
          time={time}
          type={type}
        />
        <PaymentAmounts
          amount={amountAtTime}
          deductedAmount={deductedAmountAtTime}
          type={type}
        />
        <button
          className={styles.txShowDetailBtn}
          onClick={() => !isMobile && onShowDetail(id)}
          type="button"
          data-testid="tx-details-button">
          <Loupe className={styles.iconLoupe} data-testid="tx-details" />
        </button>
      </div>
    </section>
  );
};

type TPaymentStatusProps = Pick<TLightningPayment, 'bitcoinDeposit' | 'description' | 'status' | 'time' | 'type'>;

const PaymentStatus = ({
  bitcoinDeposit,
  description,
  status,
  time,
  type,
}: TPaymentStatusProps) => {
  const { t } = useTranslation();
  const showDate = status === 'complete' && !!time;
  const isCompleteBitcoinDeposit = bitcoinDeposit?.state === 'complete';

  return (
    <span className={styles.txInfoColumn}>
      <span className={styles.txNote}>
        <span className={description && !bitcoinDeposit ? styles.txNoteText : styles.txType}>
          {bitcoinDeposit
            ? t('lightning.bitcoinDeposit.label')
            : description || <FallbackLabel type={type} />}
        </span>
      </span>
      {bitcoinDeposit && !isCompleteBitcoinDeposit ? (
        <BitcoinDepositProgress state={bitcoinDeposit.state} />
      ) : showDate ? (
        <PaymentDate time={time} />
      ) : status === 'pending' ? (
        <PaymentProgress status={status} type={type} />
      ) : (
        <PaymentStatusText status={status} type={type} />
      )}
    </span>
  );
};

type TBitcoinDepositProgressProps = {
  state: TBitcoinDepositState;
};

const BitcoinDepositProgress = ({ state }: TBitcoinDepositProgressProps) => {
  const { t } = useTranslation();

  return (
    <span className={styles.txProgress}>
      <span className={styles.txProgressTextLong}>
        {t(`lightning.bitcoinDeposit.state.${state}`)}
      </span>
      <span className={styles.txProgressTextShort}>
        {t(`lightning.bitcoinDeposit.stateShort.${state}`)}
      </span>
      {state !== 'unclaimed' && (
        <ProgressRing
          className={styles.iconProgress}
          width={18}
          value={state === 'confirming' ? 33 : 66}
          isComplete={false}
        />
      )}
    </span>
  );
};

type TPaymentProgressProps = Pick<TLightningPayment, 'status' | 'type'>;

const PaymentProgress = ({ status, type }: TPaymentProgressProps) => {
  const { t } = useTranslation();
  const isComplete = status === 'complete';

  return (
    <span className={styles.txProgress}>
      <span className={styles.txProgressTextLong}>
        {t(`transaction.status.${status}`, { context: type })}
      </span>
      <span className={styles.txProgressTextShort}>
        {t(`transaction.statusShort.${status}`, { context: type })}
      </span>
      <ProgressRing
        className={styles.iconProgress}
        width={18}
        value={isComplete ? 100 : 50}
        isComplete={isComplete}
      />
    </span>
  );
};

const PaymentStatusText = ({ status, type }: TPaymentProgressProps) => {
  const { t } = useTranslation();

  return (
    <span className={styles.txDate}>
      {t(`transaction.status.${status}`, { context: type })}
    </span>
  );
};

type TPaymentAmountsProps = {
  amount: TLightningPayment['amountAtTime'];
  deductedAmount: TLightningPayment['deductedAmountAtTime'];
  type: TLightningPayment['type'];
};

const PaymentAmounts = ({
  amount,
  deductedAmount,
  type,
}: TPaymentAmountsProps) => {
  const txTypeClass = `txAmount-${type}`;
  const displayAmount = type === 'receive' ? amount : deductedAmount;

  return (
    <span
      className={`
        ${styles.txAmountsColumn || ''}
        ${styles[txTypeClass] || ''}
      `}
      data-testid="tx-amounts">
      <span className={styles.txAmount}>
        {displayAmount.amount !== '0' && getTxSign(type)}
        <AmountWithUnit
          amount={displayAmount}
          maxDecimals={9}
          unitClassName={styles.txUnit}
        />
      </span>
      <ConversionAmount amount={amount} deductedAmount={deductedAmount} type={type} />
    </span>
  );
};

type TPaymentDateProps = {
  time: string;
};

const PaymentDate = ({ time }: TPaymentDateProps) => {
  const { i18n } = useTranslation();

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

type TFallbackLabelProps = Pick<TLightningPayment, 'type'>;

const FallbackLabel = ({ type }: TFallbackLabelProps) => {
  const { t } = useTranslation();
  return type === 'receive' ? t('generic.received') : t('generic.sent');
};
