// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePrevious } from '@/hooks/previous';
import * as accountApi from '@/api/account';
import { convertFromCurrency, convertToCurrency } from '@/api/coins';
import { View, ViewContent } from '@/components/view/view';
import { alertUser } from '@/components/alert/Alert';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main, ResponsiveGrid } from '@/components/layout';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { FeeTargets } from './feetargets';
import { isBitcoinOnly } from '@/routes/account/utils';
import { ConfirmSend } from './components/confirm/confirm';
import { SendGuide } from './send-guide';
import { SendResult } from './components/result';
import { CoinInput } from './components/inputs/coin-input';
import { FiatInput } from './components/inputs/fiat-input';
import { FiatValue } from '@/components/amount/fiat-value';
import { FiatValue as RbfFiatValue } from './components/fiat-value';
import { TProposalError, txProposalErrorHandling } from './services';
import { connectKeystore } from '@/api/keystores';
import { RatesContext } from '@/contexts/RatesContext';
import { Message } from '@/components/message/message';
import { useAccountBalance } from './send-shared';
import style from './send.module.css';

type TRbfData = {
  address: string;
  amount: string;
  note: string;
  originalFeeRate: number;
};

type TProps = {
  account: accountApi.TAccount;
  rbfTxID: string;
};

type TRbfReadOnlyFieldProps = {
  label: string;
  value: string;
};

type TRbfAmountSectionProps = {
  account: accountApi.TAccount;
  amount: string;
  balance?: accountApi.TBalance;
  defaultCurrency: accountApi.ConversionUnit;
  errorHandling: TProposalError;
  fiatAmount: string;
  onCoinAmountChange: (amount: string) => void;
  onFiatInput: (amount: string) => void;
  onSendAllChange: (sendAll: boolean) => void;
  proposedAmount?: accountApi.TAmountWithConversions;
  rbfAmountLocked: boolean;
  sendAll: boolean;
};

const SATOSHI_UNITS = ['sat', 'tsat', 'rsat'];

const amountToSats = (amount: string, unit: string): number | null => {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) {
    return null;
  }
  return SATOSHI_UNITS.includes(unit.toLowerCase()) ? parsedAmount : parsedAmount * 100000000;
};

const RbfReadOnlyField = ({ label, value }: TRbfReadOnlyFieldProps) => (
  <div className={style.rbfField}>
    <label>{label}</label>
    <p className={style.rbfPrimaryValue}>{value}</p>
  </div>
);

const RbfAmountSection = ({
  account,
  amount,
  balance,
  defaultCurrency,
  errorHandling,
  fiatAmount,
  onCoinAmountChange,
  onFiatInput,
  onSendAllChange,
  proposedAmount,
  rbfAmountLocked,
  sendAll,
}: TRbfAmountSectionProps) => {
  const { t } = useTranslation();

  if (rbfAmountLocked) {
    return (
      <div className={style.rbfField}>
        <label>{t('send.rbf.sendAmount')}</label>
        <div className={style.rbfAmountContainer}>
          <p className={style.rbfPrimaryValue}>
            {amount}
            {' '}
            {balance?.available.unit || account.coinCode.toUpperCase()}
          </p>
          {fiatAmount ? (
            <RbfFiatValue
              amount={fiatAmount}
              baseCurrencyUnit={defaultCurrency}
              className={style.rbfFiatAmount}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={style.rbfField}>
      <label>{t('send.rbf.sendAmount')}</label>
      <Grid>
        <Column>
          <CoinInput
            balance={balance}
            onAmountChange={onCoinAmountChange}
            onSendAllChange={onSendAllChange}
            sendAll={sendAll}
            amountError={errorHandling.amountError}
            proposedAmount={proposedAmount}
            amount={amount}
            hasSelectedUTXOs={false}
          />
        </Column>
        <Column>
          <FiatInput
            onFiatChange={onFiatInput}
            disabled={sendAll}
            error={errorHandling.amountError}
            fiatAmount={fiatAmount}
            label={defaultCurrency}
          />
        </Column>
      </Grid>
    </div>
  );
};

const parseRbfData = (transaction: accountApi.TTransaction): TRbfData | null => {
  if (!transaction.rbfReconstructable || transaction.addresses.length !== 1) {
    return null;
  }
  const address = transaction.addresses?.[0];
  const amount = transaction.amount?.amount;
  const feeInSats = transaction.fee?.amount && transaction.fee?.unit
    ? amountToSats(transaction.fee.amount, transaction.fee.unit)
    : null;
  const originalFeeRate = feeInSats !== null && transaction.vsize > 0
    ? feeInSats / transaction.vsize
    : null;

  if (!address || !amount || originalFeeRate === null || !Number.isFinite(originalFeeRate)) {
    return null;
  }

  return {
    address,
    amount,
    note: transaction.note || '',
    originalFeeRate,
  };
};

export const SendRbf = ({
  account,
  rbfTxID,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { btcUnit, defaultCurrency } = useContext(RatesContext);
  const lastProposal = useRef<Promise<accountApi.TTxProposalResult> | null>(null);
  const proposeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rbfTxNotFoundRetriedRef = useRef(false);
  const retryProposalRef = useRef<(updateFiat?: boolean) => void>(() => {});

  const [rbfData, setRbfData] = useState<TRbfData | null>(null);
  const [amount, setAmount] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [valid, setValid] = useState(false);
  const [sendAll, setSendAll] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUpdatingProposal, setIsUpdatingProposal] = useState(false);
  const [rbfAmountLocked, setRbfAmountLocked] = useState(true);
  const [customFee, setCustomFee] = useState('');
  const [errorHandling, setErrorHandling] = useState<TProposalError>({});
  const [proposedFee, setProposedFee] = useState<accountApi.TAmountWithConversions>();
  const [proposedTotal, setProposedTotal] = useState<accountApi.TAmountWithConversions>();
  const [proposedAmount, setProposedAmount] = useState<accountApi.TAmountWithConversions>();
  const [recipientDisplayAddress, setRecipientDisplayAddress] = useState('');
  const [feeTarget, setFeeTarget] = useState<accountApi.FeeTargetCode>();
  const [sendResult, setSendResult] = useState<accountApi.TSendTx>();
  const [rbfAlreadyConfirmed, setRbfAlreadyConfirmed] = useState(false);
  const [updateFiat, setUpdateFiat] = useState(true);

  const prevDefaultCurrency = usePrevious(defaultCurrency);
  const prevBtcUnit = usePrevious(btcUnit);


  const balance = useAccountBalance(account.code, btcUnit);

  useEffect(() => {
    setRbfData(null);
    setAmount('');
    setFiatAmount('');
    setValid(false);
    setSendAll(false);
    setIsConfirming(false);
    setIsUpdatingProposal(false);
    setRbfAmountLocked(true);
    setCustomFee('');
    setErrorHandling({});
    setProposedFee(undefined);
    setProposedTotal(undefined);
    setProposedAmount(undefined);
    setRecipientDisplayAddress('');
    setFeeTarget(undefined);
    setSendResult(undefined);
    setRbfAlreadyConfirmed(false);
    setUpdateFiat(true);
    rbfTxNotFoundRetriedRef.current = false;

    let cancelled = false;
    void accountApi.getTransaction(account.code, rbfTxID).then(transaction => {
      if (cancelled) {
        return;
      }
      if (!transaction) {
        alertUser(t('send.error.rbfTxNotFound'));
        navigate(`/account/${account.code}`, { replace: true });
        return;
      }
      const nextRbfData = parseRbfData(transaction);
      if (!nextRbfData) {
        alertUser(t('transaction.speedUpError'));
        navigate(`/account/${account.code}`, { replace: true });
        return;
      }
      setRbfData(nextRbfData);
      setAmount(nextRbfData.amount);
      if (transaction.numConfirmations > 0) {
        setProposedAmount(transaction.amount);
        setRbfAlreadyConfirmed(true);
        setSendResult({ success: true, txId: transaction.txID });
      }
    }).catch(() => {
      if (!cancelled) {
        alertUser(t('send.error.rbfTxNotFound'));
        navigate(`/account/${account.code}`, { replace: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [account.code, navigate, rbfTxID, t]);

  const handleContinue = () => {
    setSendResult(undefined);
    setRbfAlreadyConfirmed(false);
  };

  const handleRetry = () => {
    setSendResult(undefined);
    setRbfAlreadyConfirmed(false);
  };

  const waitForConfirmedTx = useCallback(async (txID: string): Promise<string | null> => {
    const attempts = 5;
    for (let i = 0; i < attempts; i++) {
      const transaction = await accountApi.getTransaction(account.code, txID).catch(() => null);
      if (transaction && transaction.numConfirmations > 0) {
        return transaction.txID;
      }
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return null;
  }, [account.code]);

  const handleSend = useCallback(async () => {
    if (!rbfData) {
      return;
    }
    const rootFingerprint = account.keystore.rootFingerprint;
    const connectResult = await connectKeystore(rootFingerprint);
    if (!connectResult.success) {
      return;
    }
    setIsConfirming(true);
    setRbfAlreadyConfirmed(false);
    try {
      const result = await accountApi.sendTx(account.code, rbfData.note);
      if (!result.success && 'errorCode' in result && result.errorCode === 'rbfBroadcastConflict') {
        const confirmedTxID = await waitForConfirmedTx(rbfTxID);
        if (confirmedTxID) {
          setRbfAlreadyConfirmed(true);
          setSendResult({ success: true, txId: confirmedTxID });
          return;
        }
      }
      setSendResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirming(false);
    }
  }, [account.code, account.keystore.rootFingerprint, rbfData, rbfTxID, waitForConfirmedTx]);

  const getValidTxInputData = useCallback((): accountApi.TTxInput | false => {
    if (!rbfData || feeTarget === undefined || (!sendAll && !amount) || (feeTarget === 'custom' && !customFee)) {
      return false;
    }
    return {
      address: rbfData.address,
      amount,
      feeTarget,
      customFee,
      sendAll: sendAll ? 'yes' : 'no',
      selectedUTXOs: [],
      paymentRequest: null,
      useHighestFee: false,
      rbfTxID,
    };
  }, [amount, customFee, feeTarget, rbfData, rbfTxID, sendAll]);

  const convertToFiat = useCallback(async (nextAmount: string) => {
    if (nextAmount) {
      const data = await convertToCurrency({
        amount: nextAmount,
        coinCode: account.coinCode,
        fiatUnit: defaultCurrency,
      });
      if (data.success) {
        setFiatAmount(data.fiatAmount);
      } else {
        setErrorHandling({
          amountError: t('send.error.invalidAmount'),
        });
      }
    } else {
      setFiatAmount('');
    }
  }, [account.coinCode, defaultCurrency, t]);

  useEffect(() => {
    if (rbfData) {
      void convertToFiat(rbfData.amount);
    }
  }, [convertToFiat, rbfData]);

  const convertFromFiat = useCallback(async (nextAmount: string) => {
    if (nextAmount) {
      const data = await convertFromCurrency({
        amount: nextAmount,
        coinCode: account.coinCode,
        fiatUnit: defaultCurrency,
      });
      if (data.success) {
        setAmount(data.amount);
        setUpdateFiat(false);
      } else {
        setErrorHandling({ amountError: t('send.error.invalidAmount') });
      }
    } else {
      setAmount('');
    }
  }, [account.coinCode, defaultCurrency, t]);

  const txProposal = useCallback((shouldUpdateFiat: boolean, result: accountApi.TTxProposalResult) => {
    setValid(result.success);
    if (result.success) {
      rbfTxNotFoundRetriedRef.current = false;
      setErrorHandling({});
      setProposedFee(result.fee);
      setProposedAmount(result.amount);
      setProposedTotal(result.total);
      setRecipientDisplayAddress(result.recipientDisplayAddress);
      setIsUpdatingProposal(false);
      if (shouldUpdateFiat) {
        convertToFiat(result.amount.amount);
      }
      setRbfAmountLocked(true);
      return;
    }

    let nextErrorHandling = txProposalErrorHandling(result.errorCode);
    if (result.errorCode === 'rbfFeeTooLow' && rbfData) {
      const minFee = Math.ceil(rbfData.originalFeeRate) + 1;
      nextErrorHandling = { feeError: t('send.error.rbfFeeTooLow', { minFeeRate: minFee }) };
    }
    setErrorHandling(nextErrorHandling);
    setIsUpdatingProposal(false);

    if (result.errorCode === 'rbfTxAlreadyConfirmed') {
      rbfTxNotFoundRetriedRef.current = false;
      setRbfAlreadyConfirmed(true);
      setSendResult({ success: true, txId: rbfTxID });
      return;
    }

    if (result.errorCode === 'rbfTxNotReplaceable') {
      rbfTxNotFoundRetriedRef.current = false;
      alertUser(t('send.error.rbfTxNotReplaceable'));
      return;
    }

    if (result.errorCode === 'rbfTxNotFound') {
      if (rbfTxNotFoundRetriedRef.current) {
        alertUser(t('send.error.rbfTxNotFound'));
        rbfTxNotFoundRetriedRef.current = false;
        return;
      }
      rbfTxNotFoundRetriedRef.current = true;
      void accountApi.getTransaction(account.code, rbfTxID).then(transaction => {
        if (!transaction) {
          alertUser(t('send.error.rbfTxNotFound'));
          rbfTxNotFoundRetriedRef.current = false;
          return;
        }
        if (transaction.numConfirmations > 0) {
          setRbfAlreadyConfirmed(true);
          setSendResult({ success: true, txId: transaction.txID });
          rbfTxNotFoundRetriedRef.current = false;
          return;
        }
        retryProposalRef.current(shouldUpdateFiat);
      }).catch(() => {
        alertUser(t('send.error.rbfTxNotFound'));
        rbfTxNotFoundRetriedRef.current = false;
      });
      return;
    }

    rbfTxNotFoundRetriedRef.current = false;

    if (result.errorCode === 'insufficientFunds') {
      setRbfAmountLocked(false);
    }

    if (
      nextErrorHandling.amountError
      || Object.keys(nextErrorHandling).length === 0
    ) {
      setProposedFee(undefined);
    }
    setRecipientDisplayAddress('');
  }, [account.code, convertToFiat, rbfData, rbfTxID, t]);

  const validateAndDisplayFee = useCallback((shouldUpdateFiat: boolean = true) => {
    setProposedTotal(undefined);
    setErrorHandling({});
    const txInput = getValidTxInputData();
    if (!txInput) {
      return;
    }
    if (proposeTimeout.current) {
      clearTimeout(proposeTimeout.current);
      proposeTimeout.current = null;
    }
    setIsUpdatingProposal(true);
    proposeTimeout.current = setTimeout(async () => {
      let proposePromise;
      try {
        proposePromise = accountApi.proposeTx(account.code, txInput);
        lastProposal.current = proposePromise;
        const result = await proposePromise;
        if (proposePromise === lastProposal.current) {
          txProposal(shouldUpdateFiat, result);
        }
      } catch (error) {
        if (proposePromise === lastProposal.current) {
          setValid(false);
          console.error('Failed to propose transaction:', error);
        }
      } finally {
        if (proposePromise === lastProposal.current) {
          lastProposal.current = null;
        }
      }
    }, 400);
  }, [account.code, getValidTxInputData, txProposal]);

  useEffect(() => {
    retryProposalRef.current = validateAndDisplayFee;
  }, [validateAndDisplayFee]);

  useEffect(() => {
    if (rbfData) {
      validateAndDisplayFee(updateFiat);
    }
  }, [amount, customFee, feeTarget, fiatAmount, rbfData, updateFiat, validateAndDisplayFee]);

  useEffect(() => {
    if (!rbfData) {
      return;
    }

    const currencyChanged = prevDefaultCurrency !== undefined && prevDefaultCurrency !== defaultCurrency;
    const btcUnitChanged = prevBtcUnit !== undefined && prevBtcUnit !== btcUnit;

    if (!currencyChanged && !btcUnitChanged) {
      return;
    }

    if (btcUnitChanged && isBitcoinOnly(account.coinCode)) {
      if (sendAll && getValidTxInputData()) {
        validateAndDisplayFee(true);
      } else if (amount) {
        const fiatUnit = prevBtcUnit === 'default' ? 'BTC' : 'sat';
        convertFromCurrency({
          amount,
          coinCode: account.coinCode,
          fiatUnit,
        }).then(data => {
          if (data.success) {
            setAmount(data.amount);
            setUpdateFiat(false);
          } else {
            setErrorHandling({ amountError: t('send.error.invalidAmount') });
          }
        }).catch(() => {
          setErrorHandling({ amountError: t('send.error.invalidAmount') });
        });
      }
      return;
    }

    if (currencyChanged) {
      const amountToConvert = sendAll ? (proposedAmount ? proposedAmount.amount : '') : amount;
      convertToFiat(amountToConvert);
    }
  }, [
    account.coinCode,
    amount,
    convertToFiat,
    defaultCurrency,
    getValidTxInputData,
    prevBtcUnit,
    prevDefaultCurrency,
    proposedAmount,
    rbfData,
    sendAll,
    t,
    validateAndDisplayFee,
    btcUnit,
  ]);

  const handleFeeTargetChange = (newFeeTarget: accountApi.FeeTargetCode) => {
    setFeeTarget(newFeeTarget);
    if (newFeeTarget !== 'custom') {
      setCustomFee('');
    }
    setUpdateFiat(true);
  };

  const handleFiatInput = (nextAmount: string) => {
    setFiatAmount(nextAmount);
    convertFromFiat(nextAmount);
  };

  const handleCoinAmountChange = (nextAmount: string) => {
    convertToFiat(nextAmount);
    setAmount(nextAmount);
    setUpdateFiat(true);
  };

  const handleSendAllChange = (nextSendAll: boolean) => {
    if (!nextSendAll) {
      convertToFiat(amount);
    }
    setSendAll(nextSendAll);
    setUpdateFiat(true);
  };

  const handleCustomFee = (nextCustomFee: string) => {
    setCustomFee(nextCustomFee);
    setUpdateFiat(false);
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('send.rbf.title', { accountName: account.coinName })}</h2>} />
          <View>
            <ViewContent>
              <Message
                type="info"
                className={style.rbfBanner}>
                {t('send.rbf.banner', { txID: `${rbfTxID.substring(0, 10)}...` })}
              </Message>

              {!rbfData && !sendResult ? (
                <Message type="info">
                  {t('loading')}
                </Message>
              ) : rbfData ? (
                <ResponsiveGrid className={[style.sendForm, style.rbfForm].filter((className): className is string => Boolean(className)).join(' ')}>
                  <Column
                    col="2"
                    className={style.rbfSection}>
                    <RbfAmountSection
                      account={account}
                      amount={amount}
                      balance={balance}
                      defaultCurrency={defaultCurrency}
                      errorHandling={errorHandling}
                      fiatAmount={fiatAmount}
                      onCoinAmountChange={handleCoinAmountChange}
                      onFiatInput={handleFiatInput}
                      onSendAllChange={handleSendAllChange}
                      proposedAmount={proposedAmount}
                      rbfAmountLocked={rbfAmountLocked}
                      sendAll={sendAll}
                    />
                  </Column>
                  <Column
                    col="2"
                    className={style.rbfSection}>
                    <RbfReadOnlyField
                      label={t('send.address.label')}
                      value={rbfData.address}
                    />
                  </Column>
                  <Column
                    col="2"
                    className={style.rbfSection}>
                    <FeeTargets
                      accountCode={account.code}
                      coinCode={account.coinCode}
                      disabled={!amount && !sendAll}
                      proposedFee={proposedFee}
                      customFee={customFee}
                      showCalculatingFeeLabel={isUpdatingProposal}
                      onFeeTargetChange={handleFeeTargetChange}
                      onCustomFee={handleCustomFee}
                      error={errorHandling.feeError}
                      preferredFeeTarget="high"
                      value={feeTarget}
                      label={t('send.rbf.newPriority')}
                      minFeeRate={rbfData ? Math.ceil(rbfData.originalFeeRate) + 1 : undefined}
                    />
                  </Column>
                  <Column
                    col="2"
                    className={style.rbfSection}>
                    <RbfReadOnlyField
                      label={t('note.title')}
                      value={rbfData.note || '-'}
                    />
                    <ColumnButtons
                      className="m-top-default m-bottom-xlarge"
                      inline>
                      <Button
                        primary
                        onClick={handleSend}
                        disabled={!getValidTxInputData() || !valid || isUpdatingProposal}>
                        {t('send.button')}
                      </Button>
                      <BackButton enableEsc={!isConfirming}>
                        {t('dialog.cancel')}
                      </BackButton>
                    </ColumnButtons>
                  </Column>
                </ResponsiveGrid>
              ) : null}
            </ViewContent>
            <ConfirmSend
              note={rbfData?.note || ''}
              hasSelectedUTXOs={false}
              isConfirming={isConfirming}
              selectedUTXOs={{}}
              coinCode={account.coinCode}
              isRBF
              transactionDetails={{
                proposedFee,
                proposedAmount,
                proposedTotal,
                customFee,
                feeTarget,
                recipientDisplayAddress,
              }}
            />
            {sendResult && (
              <SendResult
                code={account.code}
                result={sendResult}
                onContinue={handleContinue}
                onRetry={handleRetry}
                successMessage={t(rbfAlreadyConfirmed ? 'send.rbf.alreadyConfirmed' : 'send.rbf.success')}
                hideSecondaryAction>
                <p>
                  {proposedAmount && (
                    <AmountWithUnit
                      amount={proposedAmount}
                      alwaysShowAmounts
                      enableRotateUnit
                      unitClassName={style.unit}
                    />
                  )}
                  <br />
                  {proposedAmount?.conversions?.[defaultCurrency] ? (
                    <FiatValue amount={proposedAmount} enableRotateUnit />
                  ) : null}
                </p>
              </SendResult>
            )}
          </View>
        </Main>
      </GuidedContent>
      <SendGuide coinCode={account.coinCode} />
    </GuideWrapper>
  );
};
