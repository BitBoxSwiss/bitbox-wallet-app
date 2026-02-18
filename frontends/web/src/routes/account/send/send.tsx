// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TSelectedUTXOs } from './utxos';
import { useMountedRef } from '@/hooks/mount';
import { usePrevious } from '@/hooks/previous';
import * as accountApi from '@/api/account';
import { syncdone } from '@/api/accountsync';
import { convertFromCurrency, convertToCurrency, parseExternalBtcAmount, type BtcUnit } from '@/api/coins';
import { View, ViewContent } from '@/components/view/view';
import { alertUser } from '@/components/alert/Alert';
import { Balance } from '@/components/balance/balance';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { FeeTargets } from './feetargets';
import { isBitcoinBased, isBitcoinOnly } from '@/routes/account/utils';
import { ConfirmSend } from './components/confirm/confirm';
import { SendGuide } from './send-guide';
import { SendResult } from './components/result';
import { ReceiverAddressInput } from './components/inputs/receiver-address-input';
import { CoinInput } from './components/inputs/coin-input';
import { FiatInput } from './components/inputs/fiat-input';
import { NoteInput } from './components/inputs/note-input';
import { FiatValue } from './components/fiat-value';
import { TProposalError, txProposalErrorHandling } from './services';
import { CoinControl } from './coin-control';
import { connectKeystore } from '@/api/keystores';
import { SubTitle } from '@/components/title';
import { RatesContext } from '@/contexts/RatesContext';
import { Message } from '@/components/message/message';
import { useMediaQuery } from '@/hooks/mediaquery';
import style from './send.module.css';

// RBF state passed from transaction details dialog
type TRBFState = {
  txID: string;
  address: string;
  amount: string;
  note?: string;
  // Original fee rate in sat/vB - used to calculate minimum fee in low-fee environments
  originalFeeRate: number;
};

type TRBFRouteState = {
  txID: string;
};

const SATOSHI_UNITS = ['sat', 'tsat', 'rsat'];

const amountToSats = (amount: string, unit: string): number | null => {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) {
    return null;
  }
  return SATOSHI_UNITS.includes(unit.toLowerCase()) ? parsedAmount : parsedAmount * 100000000;
};

const isInputsMissingOrSpentError = (errorMessage?: string): boolean => {
  if (!errorMessage) {
    return false;
  }
  return errorMessage.toLowerCase().includes('bad-txns-inputs-missingorspent');
};

type TProps = {
  account: accountApi.TAccount;
  activeAccounts?: accountApi.TAccount[];
  activeCurrency: accountApi.Fiat;
};

const useAccountBalance = (accountCode: accountApi.AccountCode, btcUnit?: BtcUnit) => {
  const mounted = useMountedRef();
  const [balance, setBalance] = useState<accountApi.TBalance>();

  const updateBalance = useCallback(async (code: accountApi.AccountCode) => {
    if (mounted.current) {
      const result = await accountApi.getBalance(code);
      if (result.success && mounted.current) {
        setBalance(result.balance);
      }
    }
  }, [mounted]);

  useEffect(() => {
    updateBalance(accountCode);
    return syncdone(accountCode, () => updateBalance(accountCode));
  }, [accountCode, updateBalance, btcUnit]);

  return balance;
};

export const Send = ({
  account,
  activeAccounts,
  activeCurrency,
}: TProps) => {
  const { t } = useTranslation();
  const { btcUnit } = useContext(RatesContext);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedUTXOsRef = useRef<TSelectedUTXOs>({});
  const [utxoDialogActive, setUtxoDialogActive] = useState(false);
  // in case there are multiple parallel tx proposals we can ignore all other but the last one
  const lastProposal = useRef<Promise<accountApi.TTxProposalResult> | null>(null);
  const proposeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // RBF (Replace-By-Fee) state
  const [rbfData, setRbfData] = useState<TRBFState | null>(null);
  // Whether amount field should be locked in RBF mode (unlocked if insufficient funds for new fee)
  const [rbfAmountLocked, setRbfAmountLocked] = useState<boolean>(true);
  // Track which transaction ID has been initialized for RBF to handle component reuse
  const rbfInitializedTxRef = useRef<string | null>(null);
  // Avoid infinite retries on repeated rbfTxNotFound errors.
  const rbfTxNotFoundRetriedRef = useRef<boolean>(false);
  // Allows retrying proposal from async error handlers.
  const retryProposalRef = useRef<(updateFiat?: boolean) => void>(() => {});

  // state used for the "Receiver address" input - what the user types or the account's address that is selected
  const [recipientInput, setRecipientInput] = useState<string>('');
  // the selected account when sending to another account (for confirmation display with account name and number)
  const [selectedReceiverAccount, setSelectedReceiverAccount] = useState<accountApi.TAccount | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [fiatAmount, setFiatAmount] = useState<string>('');
  const [valid, setValid] = useState<boolean>(false);
  const [sendAll, setSendAll] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isUpdatingProposal, setIsUpdatingProposal] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [customFee, setCustomFee] = useState<string>('');
  const [errorHandling, setErrorHandling] = useState<TProposalError>({});

  const [proposedFee, setProposedFee] = useState<accountApi.TAmountWithConversions>();
  const [proposedTotal, setProposedTotal] = useState<accountApi.TAmountWithConversions>();
  const [proposedAmount, setProposedAmount] = useState<accountApi.TAmountWithConversions>();
  const [feeTarget, setFeeTarget] = useState<accountApi.FeeTargetCode>();
  const [sendResult, setSendResult] = useState<accountApi.TSendTx>();
  const [rbfAlreadyConfirmed, setRbfAlreadyConfirmed] = useState<boolean>(false);

  const [updateFiat, setUpdateFiat] = useState<boolean>(true);
  const prevActiveCurrency = usePrevious(activeCurrency);
  const prevBtcUnit = usePrevious(btcUnit);

  const balance = useAccountBalance(account.code, btcUnit);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isRBFMode = !!rbfData;

  // Initialize RBF mode from router state
  useEffect(() => {
    const state = location.state as { rbf?: TRBFRouteState } | null;
    if (state?.rbf) {
      const { txID } = state.rbf;
      // Only initialize if this is a different transaction than before
      // This handles component reuse when navigating between RBF sessions
      if (rbfInitializedTxRef.current !== txID) {
        rbfInitializedTxRef.current = txID;
        rbfTxNotFoundRetriedRef.current = false;
        setRbfAlreadyConfirmed(false);
        setRbfData({ txID, address: '', amount: '', note: '', originalFeeRate: 0 });
        setRecipientInput('');
        setAmount('');
        setNote('');
        setRbfAmountLocked(true);
        setSendAll(false);
        setCustomFee('');
        setFeeTarget(undefined);
        setErrorHandling({});
        selectedUTXOsRef.current = {};

        void accountApi.getTransaction(account.code, txID).then(transaction => {
          if (rbfInitializedTxRef.current !== txID) {
            return;
          }
          if (!transaction) {
            alertUser(t('send.error.rbfTxNotFound'));
            setRbfData(null);
            rbfInitializedTxRef.current = null;
            return;
          }
          if (transaction.numConfirmations > 0) {
            setRbfAlreadyConfirmed(true);
            setSendResult({ success: true, txId: transaction.txID });
            return;
          }
          const address = transaction.addresses?.[0];
          const txAmount = transaction.amount?.amount;
          const feeInSats = transaction.fee?.amount && transaction.fee?.unit
            ? amountToSats(transaction.fee.amount, transaction.fee.unit)
            : null;
          const originalFeeRate = feeInSats !== null && transaction.vsize > 0
            ? feeInSats / transaction.vsize
            : null;
          if (!address || !txAmount || originalFeeRate === null || !Number.isFinite(originalFeeRate)) {
            alertUser(t('transaction.speedUpError'));
            setRbfData(null);
            rbfInitializedTxRef.current = null;
            return;
          }
          setRbfData({
            txID,
            address,
            amount: txAmount,
            note: transaction.note || '',
            originalFeeRate,
          });
          setRecipientInput(address);
          setAmount(txAmount);
          setNote(transaction.note || '');
          setRbfAmountLocked(true);
          setUpdateFiat(true);
        }).catch(() => {
          if (rbfInitializedTxRef.current !== txID) {
            return;
          }
          alertUser(t('send.error.rbfTxNotFound'));
          setRbfData(null);
          rbfInitializedTxRef.current = null;
        });

        // For RBF, we start with 'high' fee target for fast confirmation in normal fee environments.
        // If 'high' fee is insufficient (in low fee environments where all targets return 1 sat/vB),
        // the backend will return rbfFeeTooLow error and we'll switch to custom mode with minimum fee.
        // Don't set feeTarget here - let FeeTargets component initialize with preferredFeeTarget='high'
      }
      // Clear the router state to prevent re-initialization on re-render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [account.code, location.pathname, location.state, navigate, t]);

  const handleContinue = () => {
    setSendAll(false);
    setIsConfirming(false);
    setRecipientInput('');
    setSelectedReceiverAccount(null);
    setProposedAmount(undefined);
    setProposedFee(undefined);
    setProposedTotal(undefined);
    setFiatAmount('');
    setAmount('');
    setNote('');
    setCustomFee('');
    setSendResult(undefined);
    setRbfAlreadyConfirmed(false);
    selectedUTXOsRef.current = {};
    // Clear RBF state
    setRbfData(null);
    setRbfAmountLocked(true);
    rbfInitializedTxRef.current = null;
    rbfTxNotFoundRetriedRef.current = false;
  };

  const handleRetry = () => {
    setSendResult(undefined);
    setRbfAlreadyConfirmed(false);
  };

  const waitForConfirmedTx = useCallback(async (txID: string): Promise<string | null> => {
    const attempts = 5;
    for (let i = 0; i < attempts; i++) {
      const tx = await accountApi.getTransaction(account.code, txID).catch(() => null);
      if (tx && tx.numConfirmations > 0) {
        return tx.txID;
      }
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return null;
  }, [account.code]);

  const handleSend = useCallback(async () => {
    const rootFingerprint = account.keystore.rootFingerprint;
    const connectResult = await connectKeystore(rootFingerprint);
    if (!connectResult.success) {
      return;
    }
    setIsConfirming(true);
    setRbfAlreadyConfirmed(false);
    try {
      const result = await accountApi.sendTx(account.code, note);
      if (
        rbfData &&
        !result.success &&
        'errorMessage' in result &&
        isInputsMissingOrSpentError(result.errorMessage)
      ) {
        const confirmedTxID = await waitForConfirmedTx(rbfData.txID);
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
      // The following method allows pressing escape again.
      setIsConfirming(false);
    }
  }, [account.code, account.keystore.rootFingerprint, note, rbfData, waitForConfirmedTx]);

  const getValidTxInputData = useCallback((): accountApi.TTxInput | false => {
    if (
      !recipientInput
      || feeTarget === undefined
      || (!sendAll && !amount)
      || (feeTarget === 'custom' && !customFee)
    ) {
      return false;
    }
    return {
      address: recipientInput,
      amount,
      feeTarget,
      customFee,
      sendAll: (sendAll ? 'yes' : 'no'),
      selectedUTXOs: Object.keys(selectedUTXOsRef.current),
      paymentRequest: null,
      useHighestFee: false,
      rbfTxID: rbfData?.txID,
    };
  }, [recipientInput, feeTarget, sendAll, amount, customFee, rbfData]);

  const convertToFiat = useCallback(async (amount: string) => {
    if (amount) {
      const coinCode = account.coinCode;
      const data = await convertToCurrency({
        amount,
        coinCode,
        fiatUnit: activeCurrency,
      });
      if (data.success) {
        setFiatAmount(data.fiatAmount);
      } else {
        setErrorHandling({
          amountError: t('send.error.invalidAmount')
        });
      }
    } else {
      setFiatAmount('');
    }
  }, [account.coinCode, activeCurrency, t]);

  // Convert RBF amount to fiat when RBF mode is initialized
  useEffect(() => {
    if (rbfData) {
      convertToFiat(rbfData.amount);
    }
  }, [rbfData, convertToFiat]);

  const convertFromFiat = useCallback(async (amount: string) => {
    if (amount) {
      const coinCode = account.coinCode;
      const data = await convertFromCurrency({
        amount,
        coinCode,
        fiatUnit: activeCurrency,
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
  }, [account.coinCode, activeCurrency, t]);

  const txProposal = useCallback((
    updateFiat: boolean,
    result: accountApi.TTxProposalResult,
  ) => {
    setValid(result.success);
    if (result.success) {
      rbfTxNotFoundRetriedRef.current = false;
      setErrorHandling({});
      setProposedFee(result.fee);
      setProposedAmount(result.amount);
      setProposedTotal(result.total);
      setIsUpdatingProposal(false);
      if (updateFiat) {
        convertToFiat(result.amount.amount);
      }
      // Lock amount field again on successful proposal in RBF mode
      if (rbfData) {
        setRbfAmountLocked(true);
      }
    } else {
      const errorHandling = txProposalErrorHandling(result.errorCode);
      setErrorHandling(errorHandling);
      setIsUpdatingProposal(false);

      // Transaction got confirmed while trying to RBF. Show success screen and do not sign a new tx.
      if (rbfData && result.errorCode === 'rbfTxAlreadyConfirmed') {
        rbfTxNotFoundRetriedRef.current = false;
        setRbfAlreadyConfirmed(true);
        setSendResult({ success: true, txId: rbfData.txID });
        return;
      }

      if (rbfData && result.errorCode === 'rbfTxNotReplaceable') {
        rbfTxNotFoundRetriedRef.current = false;
        alertUser(t('send.error.rbfTxNotReplaceable'));
        return;
      }

      // If backend temporarily can't locate the original tx, re-check tx status and recover gracefully.
      if (rbfData && result.errorCode === 'rbfTxNotFound') {
        if (rbfTxNotFoundRetriedRef.current) {
          // Second failure after retry, show an explicit error.
          alertUser(t('send.error.rbfTxNotFound'));
          rbfTxNotFoundRetriedRef.current = false;
          return;
        }
        rbfTxNotFoundRetriedRef.current = true;
        void accountApi.getTransaction(account.code, rbfData.txID).then(tx => {
          if (!tx) {
            alertUser(t('send.error.rbfTxNotFound'));
            rbfTxNotFoundRetriedRef.current = false;
            return;
          }
          if (tx.numConfirmations > 0) {
            // Confirmed meanwhile, show success without asking user to sign.
            setRbfAlreadyConfirmed(true);
            setSendResult({ success: true, txId: tx.txID });
            rbfTxNotFoundRetriedRef.current = false;
            return;
          }
          // Still unconfirmed, retry proposal once.
          retryProposalRef.current(updateFiat);
        }).catch(() => {
          alertUser(t('send.error.rbfTxNotFound'));
          rbfTxNotFoundRetriedRef.current = false;
        });
        return;
      }

      rbfTxNotFoundRetriedRef.current = false;

      // In RBF mode, if we have insufficient funds (i.e. send all),
      // unlock the amount field so the user can reduce the amount
      // to accommodate the higher fee
      if (rbfData && result.errorCode === 'insufficientFunds') {
        setRbfAmountLocked(false);
      }

      // If fee is too low for RBF (low-fee environment where even 'high' returns 1 sat/vB),
      // switch to custom fee with original + 1 sat/vB (minimum required by BIP-125)
      if (rbfData && result.errorCode === 'rbfFeeTooLow') {
        const minimumFeeRate = Math.ceil(rbfData.originalFeeRate) + 1;
        setFeeTarget('custom');
        setCustomFee(minimumFeeRate.toString());
      }

      if (
        errorHandling.amountError
        || Object.keys(errorHandling).length === 0
      ) {
        setProposedFee(undefined);
      }
    }
  }, [account.code, convertToFiat, rbfData, t]);

  const validateAndDisplayFee = useCallback((
    updateFiat: boolean = true,
  ) => {
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
    // defer the transaction proposal
    proposeTimeout.current = setTimeout(async () => {
      let proposePromise;
      try {
        proposePromise = accountApi.proposeTx(account.code, txInput);
        // keep this as the last known proposal
        lastProposal.current = proposePromise;
        const result = await proposePromise;
        // continue only if this is the most recent proposal
        if (proposePromise === lastProposal.current) {
          txProposal(updateFiat, result);
        }
      } catch (error) {
        if (proposePromise === lastProposal.current) {
          setValid(false);
          console.error('Failed to propose transaction:', error);
        }
      } finally {
        // cleanup regardless of success or failure
        if (proposePromise === lastProposal.current) {
          lastProposal.current = null;
        }
      }
    }, 400); // Delay the proposal by 400 ms
  }, [account.code, getValidTxInputData, txProposal]);

  useEffect(() => {
    retryProposalRef.current = validateAndDisplayFee;
  }, [validateAndDisplayFee]);

  useEffect(() => {
    validateAndDisplayFee(updateFiat);
  }, [amount, customFee, feeTarget, fiatAmount, updateFiat, validateAndDisplayFee]);

  useEffect(() => {
    const currencyChanged = prevActiveCurrency !== undefined && prevActiveCurrency !== activeCurrency;
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
          fiatUnit
        }).then((data) => {
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
    activeCurrency,
    amount,
    btcUnit,
    convertToFiat,
    getValidTxInputData,
    prevActiveCurrency,
    prevBtcUnit,
    proposedAmount,
    sendAll,
    t,
    validateAndDisplayFee,
  ]);

  const handleFeeTargetChange = (newFeeTarget: accountApi.FeeTargetCode) => {
    setFeeTarget(newFeeTarget);
    // Only clear custom fee when switching away from custom mode
    // In RBF mode, we pre-set the custom fee and don't want it cleared
    if (newFeeTarget !== 'custom') {
      setCustomFee('');
    }
    // In RBF mode, always convert to fiat since we're pre-populating the amount
    setUpdateFiat(sendAll || !!rbfData);
  };

  const handleFiatInput = (fiatAmount: string) => {
    setFiatAmount(fiatAmount);
    convertFromFiat(fiatAmount);
  };

  const handleSelectedUTXOsChange = (selectedUTXOs: TSelectedUTXOs) => {
    selectedUTXOsRef.current = selectedUTXOs;
    setUpdateFiat(true);
    validateAndDisplayFee(true);
  };

  const hasSelectedUTXOs = (): boolean => {
    return Object.keys(selectedUTXOsRef.current).length !== 0;
  };

  // when user types in the input field or selects from dropdown
  const handleRecipientInputChange = (input: string) => {
    setRecipientInput(input);
    setUpdateFiat(true);
    setSelectedReceiverAccount(null);
  };


  const parseQRResult = async (uri: string) => {
    let qrAddress;
    let qrAmount = '';
    try {
      const url = new URL(uri);
      if (url.protocol !== 'bitcoin:' && url.protocol !== 'litecoin:' && url.protocol !== 'ethereum:') {
        alertUser(t('invalidFormat'));
        return;
      }
      qrAddress = url.pathname;
      if (isBitcoinBased(account.coinCode)) {
        qrAmount = url.searchParams.get('amount') || '';
      }
    } catch {
      qrAddress = uri;
    }

    if (qrAmount) {
      if (account.coinCode === 'btc' || account.coinCode === 'tbtc') {
        const result = await parseExternalBtcAmount(qrAmount);
        if (result.success) {
          setAmount(result.amount);
        } else {
          setRecipientInput(qrAddress);
          setSendAll(false);
          setFiatAmount('');
          setErrorHandling({ amountError: t('send.error.invalidAmount') });
          return;
        }
      } else {
        setAmount(qrAmount);
      }
    }
    setRecipientInput(qrAddress);
    setSelectedReceiverAccount(null);
    setSendAll(false);
    setFiatAmount('');
    convertToFiat(qrAmount);
    setUpdateFiat(true);
  };

  const handleCoinAmountChange = (amount: string) => {
    convertToFiat(amount);
    setAmount(amount);
    setUpdateFiat(true);
  };

  const handleSendAllChange = (sendAll: boolean) => {
    if (!sendAll) {
      convertToFiat(amount);
    }
    setSendAll(sendAll);
    setUpdateFiat(true);
  };

  const handleCustomFee = (customFee: string) => {
    setCustomFee(customFee);
    setUpdateFiat(false);
  };

  const handleNodeChange = (note: string) => setNote(note);
  const formatTxID = (txID: string): string => {
    if (txID.length <= 22) {
      return txID;
    }
    return `${txID.substring(0, 12)}...${txID.substring(txID.length - 10)}`;
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            title={<h2>{isRBFMode ? t('send.rbf.title', { accountName: account.coinName }) : t('send.title', { accountName: account.coinName })}</h2>}
          >
            <HideAmountsButton />
          </Header>
          <View>
            <ViewContent>
              {(!isRBFMode || !isMobile) && (
                <div className={style.sendHeader}>
                  <div className={style.availableBalance}>
                    <Balance balance={balance} />
                  </div>
                  <SubTitle className={style.subTitle}>
                    {t('send.transactionDetails')}
                  </SubTitle>
                  {!isRBFMode && (
                    <CoinControl
                      account={account}
                      onSelectedUTXOsChange={handleSelectedUTXOsChange}
                      onCoinControlDialogActiveChange={setUtxoDialogActive}
                    />
                  )}
                </div>
              )}

              {isRBFMode && isMobile && (
                <p className={style.rbfTxID}>{t('send.rbf.txID', { txID: formatTxID(rbfData?.txID || '') })}</p>
              )}
              {isRBFMode && !isMobile && (
                <Message type="info">
                  {t('send.rbf.banner', { txID: rbfData?.txID.substring(0, 10) + '...' })}
                </Message>
              )}

              {isRBFMode && isMobile ? (
                <>
                  <Grid col="1">
                    <Column>
                      <div className={style.rbfField}>
                        <label>{t('send.rbf.sendAmount')}</label>
                        {rbfAmountLocked ? (
                          <div className={style.rbfAmountContainer}>
                            <p className={style.rbfPrimaryValue}>
                              {amount}
                              {' '}
                              {balance?.available.unit || account.coinCode.toUpperCase()}
                            </p>
                            {fiatAmount ? (
                              <FiatValue
                                amount={fiatAmount}
                                baseCurrencyUnit={activeCurrency}
                                className={style.rbfFiatAmount}
                              />
                            ) : null}
                          </div>
                        ) : (
                          <Grid>
                            <Column>
                              <CoinInput
                                balance={balance}
                                onAmountChange={handleCoinAmountChange}
                                onSendAllChange={handleSendAllChange}
                                sendAll={sendAll}
                                amountError={errorHandling.amountError}
                                proposedAmount={proposedAmount}
                                amount={amount}
                                hasSelectedUTXOs={hasSelectedUTXOs()}
                              />
                            </Column>
                            <Column>
                              <FiatInput
                                onFiatChange={handleFiatInput}
                                disabled={sendAll}
                                error={errorHandling.amountError}
                                fiatAmount={fiatAmount}
                                label={activeCurrency}
                              />
                            </Column>
                          </Grid>
                        )}
                      </div>
                    </Column>
                  </Grid>
                  <Grid col="1">
                    <Column>
                      <div className={style.rbfField}>
                        <label>{t('send.address.label')}</label>
                        <p className={style.rbfPrimaryValue}>{recipientInput}</p>
                      </div>
                    </Column>
                  </Grid>
                  <Grid col="1">
                    <Column>
                      <div className={style.rbfField}>
                        <label>{t('note.title')}</label>
                        <p className={style.rbfPrimaryValue}>{note || '-'}</p>
                      </div>
                    </Column>
                  </Grid>
                  <Grid col="1">
                    <Column>
                      <FeeTargets
                        accountCode={account.code}
                        coinCode={account.coinCode}
                        disabled={!amount && !sendAll}
                        fiatUnit={activeCurrency}
                        proposedFee={proposedFee}
                        customFee={customFee}
                        showCalculatingFeeLabel={isUpdatingProposal}
                        onFeeTargetChange={handleFeeTargetChange}
                        onCustomFee={handleCustomFee}
                        error={errorHandling.feeError}
                        preferredFeeTarget="high"
                        value={feeTarget}
                        label={t('send.rbf.newPriority')}
                      />
                    </Column>
                  </Grid>
                  <Grid col="1">
                    <Column>
                      <ColumnButtons className="m-top-default m-bottom-xlarge">
                        <Button
                          primary
                          onClick={handleSend}
                          disabled={!getValidTxInputData() || !valid || isUpdatingProposal}>
                          {t('send.button')}
                        </Button>
                        <BackButton
                          enableEsc={!isConfirming && !utxoDialogActive}>
                          {t('dialog.cancel')}
                        </BackButton>
                      </ColumnButtons>
                    </Column>
                  </Grid>
                </>
              ) : (
                <>
                  <Grid col="1">
                    <Column>
                      <ReceiverAddressInput
                        account={account}
                        activeAccounts={activeAccounts}
                        addressError={errorHandling.addressError}
                        onInputChange={handleRecipientInputChange}
                        onAccountChange={setSelectedReceiverAccount}
                        recipientAddress={recipientInput}
                        parseQRResult={parseQRResult}
                        disabled={isRBFMode}
                      />
                    </Column>
                  </Grid>
                  <Grid>
                    <Column>
                      <CoinInput
                        balance={balance}
                        onAmountChange={handleCoinAmountChange}
                        onSendAllChange={handleSendAllChange}
                        sendAll={sendAll}
                        amountError={errorHandling.amountError}
                        proposedAmount={proposedAmount}
                        amount={amount}
                        hasSelectedUTXOs={hasSelectedUTXOs()}
                        disabled={isRBFMode && rbfAmountLocked}
                      />
                    </Column>
                    <Column>
                      <FiatInput
                        onFiatChange={handleFiatInput}
                        disabled={sendAll || (isRBFMode && rbfAmountLocked)}
                        error={errorHandling.amountError}
                        fiatAmount={fiatAmount}
                        label={activeCurrency}
                      />
                    </Column>
                  </Grid>
                  <Grid>
                    <Column>
                      <FeeTargets
                        accountCode={account.code}
                        coinCode={account.coinCode}
                        disabled={!amount && !sendAll}
                        fiatUnit={activeCurrency}
                        proposedFee={proposedFee}
                        customFee={customFee}
                        showCalculatingFeeLabel={isUpdatingProposal}
                        onFeeTargetChange={handleFeeTargetChange}
                        onCustomFee={handleCustomFee}
                        error={errorHandling.feeError}
                        preferredFeeTarget={isRBFMode ? 'high' : undefined}
                        value={feeTarget}
                      />
                    </Column>
                    <Column>
                      {isRBFMode ? (
                        <div className={style.rbfField}>
                          <label>{t('note.title')}</label>
                          <p className={style.rbfPrimaryValue}>{note || '-'}</p>
                        </div>
                      ) : (
                        <NoteInput
                          note={note}
                          onNoteChange={handleNodeChange}
                        />
                      )}
                      <ColumnButtons
                        className="m-top-default m-bottom-xlarge"
                        inline>
                        <Button
                          primary
                          onClick={handleSend}
                          disabled={!getValidTxInputData() || !valid || isUpdatingProposal}>
                          {t('send.button')}
                        </Button>
                        <BackButton
                          enableEsc={!isConfirming && !utxoDialogActive}>
                          {isRBFMode ? t('dialog.cancel') : t('button.back')}
                        </BackButton>
                      </ColumnButtons>
                    </Column>
                  </Grid>
                </>
              )}
            </ViewContent>
            <ConfirmSend
              baseCurrencyUnit={activeCurrency}
              note={note}
              hasSelectedUTXOs={hasSelectedUTXOs()}
              isConfirming={isConfirming}
              selectedUTXOs={selectedUTXOsRef.current}
              coinCode={account.coinCode}
              isRBF={isRBFMode}
              transactionDetails={{
                selectedReceiverAccount: selectedReceiverAccount || undefined,
                proposedFee,
                proposedAmount,
                proposedTotal,
                customFee,
                feeTarget,
                recipientAddress: recipientInput,
                activeCurrency,
              }}
            />
            {sendResult && (
              <SendResult
                code={account.code}
                result={sendResult}
                onContinue={handleContinue}
                onRetry={handleRetry}
                successMessage={isRBFMode ? t(rbfAlreadyConfirmed ? 'send.rbf.alreadyConfirmed' : 'send.rbf.success') : undefined}
                hideSecondaryAction={isRBFMode}>
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
                  {(proposedAmount && proposedAmount.conversions && proposedAmount.conversions[activeCurrency]) ? (
                    <FiatValue
                      amount={proposedAmount.conversions[activeCurrency] || ''}
                      baseCurrencyUnit={activeCurrency}
                      enableRotateUnit
                    />
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
