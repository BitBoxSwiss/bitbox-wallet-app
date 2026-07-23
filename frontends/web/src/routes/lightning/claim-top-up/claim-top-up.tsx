// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AccountCode, TAccount, TAmountWithConversions } from '@/api/account';
import { getListPayments, type TLightningPayment } from '@/api/lightning';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Button } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { ExternalLink } from '@/components/icon';
import { Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { useLoad } from '@/hooks/api';
import styles from './claim-top-up.module.css';

const CONTENT_MIN_HEIGHT = '38em';

const mockFeeAmount = (amount: string, fiat: string): TAmountWithConversions => ({
  amount,
  conversions: {
    EUR: fiat,
    USD: fiat,
  },
  estimated: false,
  unit: 'sat',
});

// TODO: Replace with backend-provided claim/refund fee estimates.
const MOCK_CLAIM_FEE = mockFeeAmount('100', '0.06');
const MOCK_REFUND_FEE = mockFeeAmount('100', '0.06');

type TLocationState = {
  deposits?: TLightningPayment[];
};

type TProps = {
  activeAccounts: TAccount[];
};

// Which of the two outcomes the user picked on the overview.
type TAction = 'claim' | 'refund';

type TStep = 'overview' | 'confirm' | 'success';

const noop = () => undefined;

const isUnclaimedBitcoinDeposit = (payment: TLightningPayment) => (
  payment.bitcoinDeposit?.state === 'unclaimed'
);

const sumStrings = (values: (string | undefined)[]) => {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Number.isFinite(total) ? String(total) : '';
};

// TODO: Replace with a backend-provided total once claiming is wired up, so the
// summing (and its rounding) does not happen in the frontend. Note that
// balance.incoming is not it: that sums every deposit returned by
// ListUnclaimedDeposits, including confirming and claiming ones.
const sumAmounts = (amounts: TAmountWithConversions[]): TAmountWithConversions => {
  const currencies = new Set(
    amounts.flatMap(amount => Object.keys(amount.conversions || {}))
  );
  const conversions = Object.fromEntries(
    [...currencies].map(currency => [
      currency,
      sumStrings(amounts.map(amount => amount.conversions?.[currency as keyof typeof amount.conversions])),
    ])
  );
  return {
    amount: sumStrings(amounts.map(amount => amount.amount)),
    conversions,
    estimated: amounts.some(amount => amount.estimated),
    unit: amounts[0]?.unit || 'sat',
  };
};

type TAmountRowProps = {
  amount: TAmountWithConversions;
};

const AmountRow = ({ amount }: TAmountRowProps) => (
  <div className={styles.amountRow}>
    <AmountWithUnit
      alwaysShowAmounts
      amount={amount}
      amountClassName={styles.amount}
    />
    <AmountWithUnit
      alwaysShowAmounts
      amount={amount}
      convertToFiat
      amountClassName={styles.fiat}
      unitClassName={styles.fiat}
    />
  </div>
);

type TAmountBlockProps = {
  amount?: TAmountWithConversions;
  label: string;
};

/**
 * A grey caption above the coin amount and its fiat conversion. Renders nothing
 * until there is an amount, so the callers below can already name the values the
 * backend still has to provide.
 */
const AmountBlock = ({ amount, label }: TAmountBlockProps) => {
  if (!amount) {
    return null;
  }
  return (
    <div className={styles.amountBlock}>
      <span className={styles.blockLabel}>{label}</span>
      <div className={styles.blockAmounts}>
        <AmountWithUnit
          alwaysShowAmounts
          amount={amount}
          amountClassName={styles.amount}
        />
        <AmountWithUnit
          alwaysShowAmounts
          amount={amount}
          convertToFiat
          amountClassName={styles.fiat}
          unitClassName={styles.fiat}
        />
      </div>
    </div>
  );
};

type TFeeActionProps = {
  amount?: TAmountWithConversions;
  buttonText: string;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

const FeeAction = ({
  amount,
  buttonText,
  danger,
  disabled,
  label,
  onClick,
}: TFeeActionProps) => {
  const button = danger ? (
    <Button
      className={styles.actionButton}
      danger
      disabled={disabled}
      onClick={onClick}>
      {buttonText}
    </Button>
  ) : (
    <Button
      className={styles.actionButton}
      disabled={disabled}
      onClick={onClick}
      primary>
      {buttonText}
    </Button>
  );

  return (
    <div className={styles.feeRow}>
      <AmountBlock amount={amount} label={label} />
      {button}
    </div>
  );
};

export const LightningClaimTopUp = ({ activeAccounts }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const btcAccounts = useMemo(
    () => activeAccounts.filter(account => account.active && account.coinCode === 'btc'),
    [activeAccounts]
  );
  const { state } = useLocation();
  const routeDeposits = useMemo(
    () => ((state as TLocationState | null)?.deposits ?? []).filter(isUnclaimedBitcoinDeposit),
    [state]
  );
  const payments = useLoad(getListPayments);
  const deposits = useMemo(() => {
    const loadedDeposits = payments?.filter(isUnclaimedBitcoinDeposit) ?? [];
    return loadedDeposits.length > 0 ? loadedDeposits : routeDeposits;
  }, [payments, routeDeposits]);
  const hasRouteFallback = routeDeposits.length > 0;
  const totalAmount = useMemo(
    () => sumAmounts(deposits.map(deposit => deposit.amount)),
    [deposits]
  );
  const [action, setAction] = useState<TAction>('claim');
  const [step, setStep] = useState<TStep>('overview');
  const [refundDestinationAccountCode, setRefundDestinationAccountCode] = useState<AccountCode>(btcAccounts[0]?.code || '');
  const isClaim = action === 'claim';
  const successActionKey = isClaim ? 'claim' : 'refund';
  const canConfirm = isClaim || !!refundDestinationAccountCode;

  useEffect(() => {
    if (!btcAccounts.length) {
      setRefundDestinationAccountCode('');
      return;
    }
    if (!refundDestinationAccountCode || !btcAccounts.some(account => account.code === refundDestinationAccountCode)) {
      setRefundDestinationAccountCode(btcAccounts[0]?.code || '');
    }
  }, [btcAccounts, refundDestinationAccountCode]);

  const startAction = (nextAction: TAction) => {
    setAction(nextAction);
    setStep('confirm');
  };

  const renderContent = () => {
    if (payments === undefined && !hasRouteFallback) {
      return <Spinner text={t('lightning.initializing')} />;
    }

    if (step === 'success') {
      return (
        <View key="claim-top-up-success" minHeight={CONTENT_MIN_HEIGHT} textCenter>
          <ViewContent withIcon="success">
            <div className={styles.successContent}>
              <p className={styles.successMessage}>
                {t(`lightning.claimTopUp.success.${successActionKey}Message`)}
              </p>
              <p className={styles.successNote}>
                {t(`lightning.claimTopUp.success.${successActionKey}Note`)}
              </p>
              {/* TODO: Open the transaction in the block explorer once the txid is available. */}
              <Button className={styles.transactionButton} transparent onClick={noop}>
                <ExternalLink className={styles.transactionIcon} />
                {t('lightning.claimTopUp.viewTransaction')}
              </Button>
            </div>
          </ViewContent>
          <ViewButtons>
            <Button className={styles.doneButton} primary onClick={() => navigate('/lightning')}>
              {t('button.done')}
            </Button>
          </ViewButtons>
        </View>
      );
    }

    if (step === 'confirm') {
      return (
        <View key="claim-top-up-confirm" minHeight={CONTENT_MIN_HEIGHT}>
          <ViewHeader title={t(`lightning.claimTopUp.confirm.${isClaim ? 'claimTitle' : 'refundTitle'}`)} />
          <ViewContent>
            <div className={styles.content}>
              {!isClaim && (
                <div className={styles.refundDestination}>
                  <span className={styles.blockLabel}>
                    {t('lightning.claimTopUp.confirm.refundDestination')}
                  </span>
                  <GroupedAccountSelector
                    accounts={btcAccounts}
                    className={styles.accountSelector}
                    onChange={setRefundDestinationAccountCode}
                    selected={refundDestinationAccountCode}
                  />
                </div>
              )}
              <AmountBlock
                amount={totalAmount}
                label={t('lightning.claimTopUp.confirm.totalAmount')}
              />
              <AmountBlock
                amount={isClaim ? MOCK_CLAIM_FEE : MOCK_REFUND_FEE}
                label={t('lightning.claimTopUp.confirm.fee')}
              />
            </div>
          </ViewContent>
          <ViewButtons>
            {/* TODO: Trigger the actual claim/refund once the backend exposes it. */}
            {isClaim ? (
              <Button primary onClick={() => setStep('success')}>
                {t('lightning.claimTopUp.confirm.claimButton')}
              </Button>
            ) : (
              <Button danger disabled={!canConfirm} onClick={() => setStep('success')}>
                {t('lightning.claimTopUp.confirm.refundButton')}
              </Button>
            )}
            <Button secondary onClick={() => setStep('overview')}>
              {t('dialog.cancel')}
            </Button>
          </ViewButtons>
        </View>
      );
    }

    return (
      <View key="claim-top-up" minHeight={CONTENT_MIN_HEIGHT}>
        <ViewContent>
          <div className={styles.content}>
            <div className={styles.description}>
              <p>{t('lightning.claimTopUp.description')}</p>
              <p>{t('lightning.claimTopUp.warning')}</p>
            </div>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('lightning.claimTopUp.topUps')}</h2>
              {deposits.length > 0 ? (
                <div className={styles.amountRows}>
                  {deposits.map(deposit => (
                    <AmountRow
                      key={deposit.id}
                      amount={deposit.amount}
                    />
                  ))}
                </div>
              ) : (
                <p>{t('lightning.claimTopUp.empty')}</p>
              )}
            </section>

            <section className={styles.feeActions}>
              <FeeAction
                amount={MOCK_CLAIM_FEE}
                buttonText={t('lightning.claimTopUp.claimButton')}
                disabled={deposits.length === 0}
                label={t('lightning.claimTopUp.claimFee')}
                onClick={() => startAction('claim')}
              />
              <FeeAction
                amount={MOCK_REFUND_FEE}
                buttonText={t('lightning.claimTopUp.refundButton')}
                danger
                disabled={deposits.length === 0}
                label={t('lightning.claimTopUp.refundFee')}
                onClick={() => startAction('refund')}
              />
            </section>
          </div>
        </ViewContent>
        <ViewButtons>
          <Button secondary onClick={() => navigate(-1)}>
            {t('dialog.cancel')}
          </Button>
        </ViewButtons>
      </View>
    );
  };

  return (
    <Main>
      <Header
        title={step === 'success'
          ? t(`lightning.claimTopUp.success.${successActionKey}Title`)
          : t('lightning.claimTopUp.title')
        }
      />
      {renderContent()}
    </Main>
  );
};
