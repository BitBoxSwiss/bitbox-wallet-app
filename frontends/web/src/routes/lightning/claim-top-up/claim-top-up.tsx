// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AccountCode, TAccount } from '@/api/account';
import {
  getListPayments,
  postClaimTopUp,
  postRefundTopUp,
  type TLightningPayment,
  type TTopUpRecoveryResult,
} from '@/api/lightning';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { useLoad } from '@/hooks/api';
import { useMountedRef } from '@/hooks/mount';
import { ClaimTopUpConfirm } from './confirm-step';
import { ClaimTopUpFailure } from './failure-step';
import { ClaimTopUpOverview } from './overview-step';
import { ClaimTopUpSuccess } from './success-step';
import { type TAction, type TStep } from './constants';

type TProps = {
  activeAccounts: TAccount[];
};

type TInnerProps = {
  activeAccounts: TAccount[];
  deposit: TLightningPayment | null | undefined;
};

const matchesBitcoinDeposit = (
  payment: TLightningPayment,
  paymentID: string,
) => {
  const bitcoinDeposit = payment.bitcoinDeposit;
  return bitcoinDeposit?.state === 'unclaimed'
    && payment.id === paymentID;
};

const LightningClaimTopUpInner = ({ activeAccounts, deposit }: TInnerProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const btcAccounts = useMemo(
    () => activeAccounts.filter(account => account.active && account.coinCode === 'btc'),
    [activeAccounts]
  );
  const [action, setAction] = useState<TAction>('claim');
  const [step, setStep] = useState<TStep>('overview');
  const [refundDestinationAccountCode, setRefundDestinationAccountCode] = useState<AccountCode>(btcAccounts[0]?.code || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string>();
  const [txID, setTxID] = useState<string>();
  const mounted = useMountedRef();
  const isSubmittingRef = useRef(false);
  const isClaim = action === 'claim';
  const target = deposit?.bitcoinDeposit;
  const refundFeeRateSatPerVbyte = target?.refundFeeRateSatPerVbyte;
  const canRefund = !!refundDestinationAccountCode && refundFeeRateSatPerVbyte !== undefined;
  const refundUnavailable = !!target && refundFeeRateSatPerVbyte === undefined;
  const canConfirm = !!target && !isSubmitting && (
    isClaim
      ? target.claimFeeSat !== undefined
      : canRefund
  );
  const refundDestinationAccount = btcAccounts.find(account => account.code === refundDestinationAccountCode);
  const successTxPrefix = isClaim ? btcAccounts[0]?.blockExplorerTxPrefix : refundDestinationAccount?.blockExplorerTxPrefix;
  const successExplorerURL = txID && successTxPrefix ? `${successTxPrefix}${txID}` : undefined;

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
    setRecoveryError(undefined);
    setAction(nextAction);
    setStep('confirm');
  };

  const confirmAction = async () => {
    if (!deposit || !target || isSubmittingRef.current) {
      return;
    }
    let recoverTopUp: () => Promise<TTopUpRecoveryResult>;
    if (isClaim) {
      const approvedFeeSat = target.claimFeeSat;
      if (approvedFeeSat === undefined) {
        return;
      }
      recoverTopUp = () => postClaimTopUp(deposit.id, approvedFeeSat);
    } else {
      const approvedFeeRateSatPerVbyte = target.refundFeeRateSatPerVbyte;
      if (approvedFeeRateSatPerVbyte === undefined || !refundDestinationAccountCode) {
        return;
      }
      recoverTopUp = () => postRefundTopUp(
        deposit.id,
        refundDestinationAccountCode,
        approvedFeeRateSatPerVbyte,
      );
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await recoverTopUp();
      if (!mounted.current) {
        return;
      }
      setTxID(result.txId);
      setStep('success');
    } catch (error) {
      console.error('Failed to recover Lightning top-up', error);
      if (mounted.current) {
        setRecoveryError(toLightningErrorMessage(t, error));
        setStep('failure');
      }
    } finally {
      isSubmittingRef.current = false;
      if (mounted.current) {
        setIsSubmitting(false);
      }
    }
  };

  const tryRefundAfterClaimFailure = () => {
    setAction('refund');
    setStep('confirm');
  };

  const renderContent = () => {
    if (deposit === undefined) {
      return <Spinner text={t('lightning.initializing')} />;
    }
    if (step === 'success') {
      return (
        <ClaimTopUpSuccess
          action={action}
          explorerURL={successExplorerURL}
          onDone={() => navigate('/lightning')}
        />
      );
    }
    if (step === 'failure') {
      return (
        <ClaimTopUpFailure
          action={action}
          errorMessage={!isClaim ? recoveryError : undefined}
          onDone={() => navigate('/lightning')}
          onRefund={canRefund ? tryRefundAfterClaimFailure : undefined}
        />
      );
    }
    if (step === 'confirm') {
      return (
        <ClaimTopUpConfirm
          action={action}
          btcAccounts={btcAccounts}
          canConfirm={canConfirm}
          fee={isClaim ? target?.claimFee : undefined}
          feeRateSatPerVbyte={!isClaim ? refundFeeRateSatPerVbyte : undefined}
          isSubmitting={isSubmitting}
          refundDestinationAccountCode={refundDestinationAccountCode}
          refundUnavailable={!isClaim && refundUnavailable}
          topUpAmount={deposit?.amount}
          onCancel={() => setStep('overview')}
          onConfirm={confirmAction}
          onRefundDestinationChange={setRefundDestinationAccountCode}
        />
      );
    }
    return (
      <ClaimTopUpOverview
        canClaim={target?.claimFeeSat !== undefined}
        claimFee={target?.claimFee}
        deposit={deposit}
        canRefund={canRefund}
        refundFeeRateSatPerVbyte={refundFeeRateSatPerVbyte}
        refundUnavailable={refundUnavailable}
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
  const [searchParams] = useSearchParams();
  const targetPaymentIDParam = searchParams.get('paymentId');
  const payments = useLoad(getListPayments);
  const deposit = useMemo<TLightningPayment | null | undefined>(() => {
    if (targetPaymentIDParam === null) {
      return null;
    }
    if (payments === undefined) {
      return undefined;
    }
    return payments.find(payment => matchesBitcoinDeposit(payment, targetPaymentIDParam)) ?? null;
  }, [payments, targetPaymentIDParam]);

  return (
    <LightningClaimTopUpInner
      activeAccounts={activeAccounts}
      deposit={deposit}
    />
  );
};
