// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AccountCode, TAccount } from '@/api/account';
import { getListPayments, type TLightningPayment } from '@/api/lightning';
import { Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { useLoad } from '@/hooks/api';
import { ClaimTopUpConfirm } from './confirm-step';
import { ClaimTopUpOverview } from './overview-step';
import { ClaimTopUpSuccess } from './success-step';
import { type TAction, type TStep } from './constants';
import { isUnclaimedBitcoinDeposit, sumAmounts } from './utils';

type TLocationState = {
  deposits?: TLightningPayment[];
};

type TProps = {
  activeAccounts: TAccount[];
};

type TInnerProps = {
  activeAccounts: TAccount[];
  deposits: TLightningPayment[];
  loading: boolean;
};

const LightningClaimTopUpInner = ({ activeAccounts, deposits, loading }: TInnerProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const btcAccounts = useMemo(
    () => activeAccounts.filter(account => account.active && account.coinCode === 'btc'),
    [activeAccounts]
  );
  const totalAmount = useMemo(
    () => sumAmounts(deposits.map(deposit => deposit.amount)),
    [deposits]
  );
  const [action, setAction] = useState<TAction>('claim');
  const [step, setStep] = useState<TStep>('overview');
  const [refundDestinationAccountCode, setRefundDestinationAccountCode] = useState<AccountCode>(btcAccounts[0]?.code || '');
  const isClaim = action === 'claim';
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
    if (loading) {
      return <Spinner text={t('lightning.initializing')} />;
    }
    if (step === 'success') {
      return (
        <ClaimTopUpSuccess
          action={action}
          onDone={() => navigate('/lightning')}
        />
      );
    }
    if (step === 'confirm') {
      return (
        <ClaimTopUpConfirm
          action={action}
          btcAccounts={btcAccounts}
          canConfirm={canConfirm}
          refundDestinationAccountCode={refundDestinationAccountCode}
          totalAmount={totalAmount}
          onCancel={() => setStep('overview')}
          onConfirm={() => {
            if (isClaim) {
              // TODO: Call the claim API here before advancing.
            } else {
              // TODO: Call the refund API (to refundDestinationAccountCode) here before advancing.
            }
            setStep('success');
          }}
          onRefundDestinationChange={setRefundDestinationAccountCode}
        />
      );
    }
    return (
      <ClaimTopUpOverview
        deposits={deposits}
        onCancel={() => navigate(-1)}
        onClaim={() => startAction('claim')}
        onRefund={() => startAction('refund')}
      />
    );
  };

  return (
    <Main>
      <Header
        title={step === 'success'
          ? t(`lightning.claimTopUp.success.${action}Title`)
          : t('lightning.claimTopUp.title')
        }
      />
      {renderContent()}
    </Main>
  );
};

export const LightningClaimTopUp = ({ activeAccounts }: TProps) => {
  const { state } = useLocation();
  const routeDeposits = useMemo(
    () => ((state as TLocationState | null)?.deposits ?? []).filter(isUnclaimedBitcoinDeposit),
    [state]
  );
  const payments = useLoad(getListPayments);
  const deposits = useMemo(() => {
    if (payments === undefined) {
      return routeDeposits;
    }
    return payments.filter(isUnclaimedBitcoinDeposit);
  }, [payments, routeDeposits]);
  const loading = payments === undefined && routeDeposits.length === 0;

  return (
    <LightningClaimTopUpInner
      activeAccounts={activeAccounts}
      deposits={deposits}
      loading={loading}
    />
  );
};
