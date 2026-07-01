// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as accountApi from '@/api/account';
import { convertFromCurrency, convertToCurrency } from '@/api/coins';
import { getBoardingAddress, getLightningBalance } from '@/api/lightning';
import { connectKeystore } from '@/api/keystores';
import { useMountedRef } from '@/hooks/mount';
import { usePrevious } from '@/hooks/previous';
import { getDisplayedCoinUnit, isBitcoinOnly } from '@/routes/account/utils';
import { txProposalErrorHandling, type TProposalError } from '@/routes/account/send/services';
import { RatesContext } from '@/contexts/RatesContext';
import { TopUpConfirm } from './topup-confirm';
import { TopUpForm } from './topup-form';
import { TopUpAborted, TopUpNoBitcoinAccounts, TopUpSuccess } from './topup-result';

type TProps = {
  activeAccounts: accountApi.TAccount[];
  hasAccounts: boolean;
};

type TStep = 'form' | 'confirming' | 'success' | 'aborted';

const useLightningBalance = () => {
  const mounted = useMountedRef();
  const balanceRequest = useRef(0);
  const [balance, setBalance] = useState<accountApi.TBalance>();

  const reloadBalance = useCallback(() => {
    const request = ++balanceRequest.current;
    getLightningBalance().then((nextBalance) => {
      if (request === balanceRequest.current && mounted.current) {
        setBalance(nextBalance);
      }
    }).catch(() => {
      if (request === balanceRequest.current && mounted.current) {
        setBalance(undefined);
      }
    });
  }, [mounted]);

  useEffect(() => {
    reloadBalance();
  }, [reloadBalance]);

  return {
    balance,
    reloadBalance,
  };
};

export const LightningTopUp = ({ activeAccounts, hasAccounts }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { btcUnit, defaultCurrency } = useContext(RatesContext);
  const mounted = useMountedRef();
  const boardingAddress = useRef<Promise<string> | null>(null);
  const lastProposal = useRef<Promise<accountApi.TTxProposalResult> | null>(null);
  const proposeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDefaultCurrency = usePrevious(defaultCurrency);
  const prevBtcUnit = usePrevious(btcUnit);

  const btcAccounts = useMemo(
    () => activeAccounts.filter(account => account.active && account.coinCode === 'btc'),
    [activeAccounts]
  );
  const [sourceAccountCode, setSourceAccountCode] = useState<accountApi.AccountCode>(btcAccounts[0]?.code || '');
  const sourceAccount = btcAccounts.find(account => account.code === sourceAccountCode);
  const { balance: lightningBalance, reloadBalance: reloadLightningBalance } = useLightningBalance();
  const sourceAmountUnit = sourceAccount
    ? getDisplayedCoinUnit(sourceAccount.coinCode, sourceAccount.coinUnit, btcUnit)
    : 'BTC';

  const [amount, setAmount] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [feeTarget, setFeeTarget] = useState<accountApi.FeeTargetCode>();
  const [customFee, setCustomFee] = useState('');
  const [note, setNote] = useState('');
  const [proposal, setProposal] = useState<accountApi.TTxProposalResult>();
  const [errorHandling, setErrorHandling] = useState<TProposalError>({});
  const [isUpdatingProposal, setIsUpdatingProposal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const [step, setStep] = useState<TStep>('form');
  const stepRef = useRef<TStep>('form');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!btcAccounts.length) {
      setSourceAccountCode('');
      return;
    }
    if (!sourceAccountCode || !btcAccounts.some(account => account.code === sourceAccountCode)) {
      setSourceAccountCode(btcAccounts[0]?.code || '');
    }
  }, [btcAccounts, sourceAccountCode]);

  const convertToFiat = useCallback(async (value: string) => {
    if (!sourceAccount || !value) {
      setFiatAmount('');
      return;
    }
    const data = await convertToCurrency({
      amount: value,
      coinCode: sourceAccount.coinCode,
      fiatUnit: defaultCurrency,
    });
    if (data.success) {
      setFiatAmount(data.fiatAmount);
    } else {
      setErrorHandling({ amountError: t('send.error.invalidAmount') });
    }
  }, [defaultCurrency, sourceAccount, t]);

  const convertFromFiat = useCallback(async (value: string) => {
    if (!sourceAccount || !value) {
      setAmount('');
      return;
    }
    const data = await convertFromCurrency({
      amount: value,
      coinCode: sourceAccount.coinCode,
      fiatUnit: defaultCurrency,
    });
    if (data.success) {
      setAmount(data.amount);
    } else {
      setErrorHandling({ amountError: t('send.error.invalidAmount') });
    }
  }, [defaultCurrency, sourceAccount, t]);

  const getTopUpAddress = useCallback(() => {
    if (!boardingAddress.current) {
      boardingAddress.current = getBoardingAddress().catch((error) => {
        boardingAddress.current = null;
        throw error;
      });
    }
    return boardingAddress.current;
  }, []);

  const getValidProposalInput = useCallback(() => {
    if (!sourceAccount || feeTarget === undefined || !amount || (feeTarget === 'custom' && !customFee)) {
      return null;
    }
    return {
      customFee,
      feeTarget,
      amount,
      sourceAccountCode: sourceAccount.code,
    };
  }, [amount, customFee, feeTarget, sourceAccount]);

  const validateAndDisplayFee = useCallback(() => {
    const keepCurrentProposal = stepRef.current === 'confirming';
    if (!keepCurrentProposal) {
      lastProposal.current = null;
      setProposal(undefined);
    }
    setSendError(undefined);
    setErrorHandling({});
    if (proposeTimeout.current) {
      clearTimeout(proposeTimeout.current);
      proposeTimeout.current = null;
    }
    const proposalInput = getValidProposalInput();
    if (!proposalInput) {
      setIsUpdatingProposal(false);
      return;
    }
    setIsUpdatingProposal(true);
    proposeTimeout.current = setTimeout(async () => {
      let proposePromise: Promise<accountApi.TTxProposalResult> | null = null;
      try {
        proposePromise = getTopUpAddress().then(address => accountApi.proposeTx(proposalInput.sourceAccountCode, {
          address,
          amount: proposalInput.amount,
          customFee: proposalInput.customFee,
          feeTarget: proposalInput.feeTarget,
          paymentRequest: null,
          selectedUTXOs: [],
          sendAll: 'no',
          useHighestFee: false,
        }));
        lastProposal.current = proposePromise;
        const result = await proposePromise;
        if (proposePromise !== lastProposal.current || !mounted.current) {
          return;
        }
        if (!keepCurrentProposal || result.success) {
          setProposal(result);
        }
        setIsUpdatingProposal(false);
        if (result.success) {
          setErrorHandling({});
          return;
        }
        if (keepCurrentProposal) {
          return;
        }
        setErrorHandling(txProposalErrorHandling(result.errorCode));
      } catch (error) {
        if (proposePromise === lastProposal.current && mounted.current) {
          setIsUpdatingProposal(false);
          setErrorHandling({});
          setSendError(String(error));
        }
      } finally {
        if (proposePromise === lastProposal.current) {
          lastProposal.current = null;
        }
      }
    }, 400);
  }, [getTopUpAddress, getValidProposalInput, mounted]);

  useEffect(() => {
    validateAndDisplayFee();
    return () => {
      if (proposeTimeout.current) {
        clearTimeout(proposeTimeout.current);
      }
    };
  }, [validateAndDisplayFee]);

  useEffect(() => {
    const currencyChanged = prevDefaultCurrency !== undefined && prevDefaultCurrency !== defaultCurrency;
    const btcUnitChanged = prevBtcUnit !== undefined && prevBtcUnit !== btcUnit;

    if (step === 'success' || !sourceAccount || (!currencyChanged && !btcUnitChanged)) {
      return;
    }
    if (btcUnitChanged && isBitcoinOnly(sourceAccount.coinCode) && amount) {
      const fiatUnit = prevBtcUnit === 'default' ? 'BTC' : 'sat';
      convertFromCurrency({
        amount,
        coinCode: sourceAccount.coinCode,
        fiatUnit
      }).then((data) => {
        if (data.success) {
          setAmount(data.amount);
        } else {
          setErrorHandling({ amountError: t('send.error.invalidAmount') });
        }
      }).catch(() => {
        setErrorHandling({ amountError: t('send.error.invalidAmount') });
      });
      return;
    }
    if (currencyChanged) {
      convertToFiat(amount);
    }
  }, [
    amount,
    btcUnit,
    convertToFiat,
    defaultCurrency,
    prevBtcUnit,
    prevDefaultCurrency,
    sourceAccount,
    step,
    t,
  ]);

  const handleSourceChange = (code: accountApi.AccountCode) => {
    setSourceAccountCode(code);
    setProposal(undefined);
    setSendError(undefined);
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    convertToFiat(value);
  };

  const handleFiatChange = (value: string) => {
    setFiatAmount(value);
    convertFromFiat(value);
  };

  const handleFeeTargetChange = (nextFeeTarget: accountApi.FeeTargetCode) => {
    setFeeTarget(nextFeeTarget);
    setCustomFee('');
  };

  const handleReview = async () => {
    if (isSubmittingRef.current || !sourceAccount || !proposal?.success) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const connectResult = await connectKeystore(sourceAccount.keystore.rootFingerprint);
    if (!connectResult.success) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    reloadLightningBalance();

    try {
      setStep('confirming');
      setSendError(undefined);
      const result = await accountApi.sendTx(sourceAccount.code, note);
      if (result.success) {
        setStep('success');
        return;
      }

      if ('aborted' in result) {
        setStep('aborted');
        return;
      }
      setStep('form');
      setSendError(result.errorCode ? t(`send.error.${result.errorCode}`) : result.errorMessage || t('genericError'));
    } catch (error) {
      setStep('form');
      setSendError(String(error));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (step === 'success') {
    return <TopUpSuccess />;
  }

  if (step === 'aborted') {
    return <TopUpAborted onRetry={() => setStep('form')} />;
  }

  if (step === 'confirming') {
    return (
      <TopUpConfirm
        customFee={customFee}
        feeTarget={feeTarget}
        note={note}
        proposal={proposal}
        sourceAccount={sourceAccount}
      />
    );
  }

  if (!btcAccounts.length) {
    return <TopUpNoBitcoinAccounts hasAccounts={hasAccounts} />;
  }

  const canReview = !!proposal?.success && !isUpdatingProposal && !isSubmitting;

  return (
    <TopUpForm
      amount={amount}
      btcAccounts={btcAccounts}
      canReview={canReview}
      customFee={customFee}
      defaultCurrency={defaultCurrency}
      errorHandling={errorHandling}
      fiatAmount={fiatAmount}
      isSubmitting={isSubmitting}
      isUpdatingProposal={isUpdatingProposal}
      lightningBalance={lightningBalance}
      note={note}
      onAmountChange={handleAmountChange}
      onBack={() => navigate('/lightning')}
      onCustomFeeChange={setCustomFee}
      onFeeTargetChange={handleFeeTargetChange}
      onFiatChange={handleFiatChange}
      onNoteChange={setNote}
      onReview={handleReview}
      onSourceChange={handleSourceChange}
      proposal={proposal}
      sendError={sendError}
      sourceAccount={sourceAccount}
      sourceAccountCode={sourceAccountCode}
      sourceAmountUnit={sourceAmountUnit}
    />
  );
};
