// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import type { TSelectedUTXOs } from './utxos';
import { useMountedRef } from '@/hooks/mount';
import { usePrevious } from '@/hooks/previous';
import * as accountApi from '@/api/account';
import { postPrepareTopUp, type TPrepareTopUpResult } from '@/api/lightning';
import { syncdone } from '@/api/accountsync';
import { convertFromCurrency, convertToCurrency, type BtcUnit } from '@/api/coins';
import { View, ViewContent } from '@/components/view/view';
import { alertUser } from '@/components/alert/Alert';
import { Logo } from '@/components/icon/logo';
import { Balance } from '@/components/balance/balance';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { Button, Input } from '@/components/forms';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { Column, ColumnButtons, GuideWrapper, GuidedContent, Header, Main, ResponsiveGrid } from '@/components/layout';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { FeeTargets } from './feetargets';
import { isBitcoinOnly } from '@/utils/coin';
import { ConfirmSend } from './components/confirm/confirm';
import { SendGuide } from './send-guide';
import { SendResult } from './components/result';
import { ReceiverAddressInput } from './components/inputs/receiver-address-input';
import { CoinInput } from './components/inputs/coin-input';
import { FiatInput } from './components/inputs/fiat-input';
import { NoteInput } from './components/inputs/note-input';
import { FiatValue } from '@/components/amount/fiat-value';
import { TProposalError, handleSendError, queueTxProposal } from './services';
import { CoinControl } from './coin-control';
import { connectKeystore } from '@/api/keystore';
import { SubTitle } from '@/components/title';
import { RatesContext } from '@/contexts/RatesContext';
import { formatLightningFundingLimit, formatRemainingLightningFundingLimit } from '@/routes/lightning/limits';
import { TopUpClaimFee } from '@/routes/lightning/topup/topup-claim-fee';
import { TopUpSuccess } from '@/routes/lightning/topup/topup-result';
import { useLightningRecipient } from './use-lightning-recipient';
import style from './send.module.css';

type TProps = {
  account: accountApi.TAccount;
  activeAccounts?: accountApi.TAccount[];
  fixedRecipient?: 'lightning';
  onBack?: () => void;
  onDone?: () => void;
};

type TSendProposalResult = accountApi.TTxProposalResult | TPrepareTopUpResult;

const useAccountBalance = (accountCode: accountApi.TAccountCode, btcUnit?: BtcUnit) => {
  const mounted = useMountedRef();
  const [balance, setBalance] = useState<accountApi.TBalance>();

  const updateBalance = useCallback(async (code: accountApi.TAccountCode) => {
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
  fixedRecipient,
  onBack,
  onDone,
}: TProps) => {
  const { t } = useTranslation();
  const { btcUnit, defaultCurrency } = useContext(RatesContext);
  const lightning = useLightningRecipient(account, fixedRecipient === 'lightning');
  const isLightningRecipient = lightning.selected;
  const conversionRequest = useRef(0);
  const mounted = useMountedRef();
  const selectedUTXOsRef = useRef<TSelectedUTXOs>({});
  const [utxoDialogActive, setUtxoDialogActive] = useState(false);
  // in case there are multiple parallel tx proposals we can ignore all other but the last one
  const lastProposal = useRef<Promise<TSendProposalResult | undefined> | null>(null);
  const proposeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [note, setNote] = useState(() => fixedRecipient === 'lightning' ? t('lightning.topUp.note') : '');
  const [customFee, setCustomFee] = useState<string>('');
  // Proposal and conversion errors are refreshed when transaction inputs change.
  const [errorHandling, setErrorHandling] = useState<TProposalError>({});
  // Scan validation does not require an amount. Its errors block proposals until the
  // affected field is edited or another scan replaces the input.
  const [scanErrors, setScanErrors] = useState<TProposalError>({});
  const hasScanErrors = Boolean(scanErrors.addressError || scanErrors.amountError);
  const addressError = scanErrors.addressError ?? errorHandling.addressError;
  const amountError = scanErrors.amountError ?? errorHandling.amountError;

  const [proposedFee, setProposedFee] = useState<accountApi.TAmountWithConversions>();
  const [highFeePercentage, setHighFeePercentage] = useState<string>();
  const [proposedTotal, setProposedTotal] = useState<accountApi.TAmountWithConversions>();
  const [proposedAmount, setProposedAmount] = useState<accountApi.TAmountWithConversions>();
  const [estimatedClaimFee, setEstimatedClaimFee] = useState<accountApi.TAmountWithConversions | null>();
  const [recipientDisplayAddress, setRecipientDisplayAddress] = useState('');
  const [feeTarget, setFeeTarget] = useState<accountApi.TFeeTargetCode>();
  const [sendResult, setSendResult] = useState<accountApi.TSendTx>();

  const [updateFiat, setUpdateFiat] = useState<boolean>(true);
  const prevDefaultCurrency = usePrevious(defaultCurrency);
  const prevBtcUnit = usePrevious(btcUnit);

  const balance = useAccountBalance(account.code, btcUnit);

  const handleContinue = () => {
    conversionRequest.current++;
    setScanErrors({});
    lightning.reset();
    setSendAll(false);
    setIsConfirming(false);
    setRecipientInput('');
    setSelectedReceiverAccount(null);
    setProposedAmount(undefined);
    setProposedFee(undefined);
    setHighFeePercentage(undefined);
    setProposedTotal(undefined);
    setRecipientDisplayAddress('');
    setFiatAmount('');
    setAmount('');
    setNote('');
    setCustomFee('');
    setSendResult(undefined);
    selectedUTXOsRef.current = {};
  };

  const handleRetry = () => {
    setSendResult(undefined);
  };

  const handleSend = useCallback(async () => {
    const rootFingerprint = account.keystore.rootFingerprint;
    const connectResult = await connectKeystore(rootFingerprint);
    if (!connectResult.success) {
      return;
    }
    setIsConfirming(true);
    try {
      const result = await accountApi.sendTx(account.code, note);
      setSendResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      // The following method allows pressing escape again.
      setIsConfirming(false);
    }
  }, [account.code, account.keystore.rootFingerprint, note]);

  const getValidTxInputData = useCallback(() => {
    if (
      (isLightningRecipient ? !lightning.readyAccountCode : !recipientInput)
      || hasScanErrors
      || feeTarget === undefined
      || (!sendAll && !amount)
      || (feeTarget === 'custom' && !customFee)
    ) {
      return false;
    }
    return {
      amount,
      feeTarget,
      customFee,
      sendAll,
      selectedUTXOs: Object.keys(selectedUTXOsRef.current),
    };
  }, [recipientInput, isLightningRecipient, lightning.readyAccountCode, feeTarget, sendAll, amount, customFee, hasScanErrors]);

  const convertToFiat = useCallback(async (amount: string) => {
    const request = ++conversionRequest.current;
    if (amount) {
      const coinCode = account.coinCode;
      const data = await convertToCurrency({
        amount,
        coinCode,
        fiatUnit: defaultCurrency,
      }).catch(() => undefined);
      if (request !== conversionRequest.current || !mounted.current) {
        return;
      }
      if (data?.success) {
        setFiatAmount(data.fiatAmount);
      } else {
        setErrorHandling({
          amountError: t('send.error.invalidAmount')
        });
      }
    } else {
      setFiatAmount('');
    }
  }, [account.coinCode, defaultCurrency, mounted, t]);

  const convertFromFiat = useCallback(async (amount: string, fiatUnit: accountApi.TFiat = defaultCurrency) => {
    const request = ++conversionRequest.current;
    setAmount('');
    setUpdateFiat(false);
    setErrorHandling(errors => ({ ...errors, amountError: undefined }));
    if (amount) {
      const coinCode = account.coinCode;
      const data = await convertFromCurrency({
        amount,
        coinCode,
        fiatUnit,
      }).catch(() => undefined);
      if (request !== conversionRequest.current || !mounted.current) {
        return;
      }
      if (data?.success) {
        setAmount(data.amount);
      } else {
        setErrorHandling({ amountError: t('send.error.invalidAmount') });
      }
    }
  }, [account.coinCode, defaultCurrency, mounted, t]);

  const txProposal = useCallback((
    updateFiat: boolean,
    result: TSendProposalResult,
  ) => {
    setValid(result.success);
    setEstimatedClaimFee(result.success && 'estimatedClaimFee' in result ? result.estimatedClaimFee : undefined);
    if (result.success) {
      setErrorHandling({});
      setProposedFee(result.fee);
      setHighFeePercentage(result.highFeePercentage);
      setProposedAmount(result.amount);
      setProposedTotal(result.total);
      setRecipientDisplayAddress(result.recipientDisplayAddress);
      setIsUpdatingProposal(false);
      if (updateFiat) {
        convertToFiat(result.amount.amount);
      }
    } else {
      let errorHandling: TProposalError;
      if ('minAmountSat' in result) {
        errorHandling = { amountError: t('error.lightningAmountBelowMinimum', { minAmountSat: result.minAmountSat }) };
      } else if ('fundingLimit' in result) {
        errorHandling = {
          amountError: t('error.lightningBalanceLimitExceeded', {
            limit: formatLightningFundingLimit(result.fundingLimit),
            remaining: formatRemainingLightningFundingLimit(result.fundingLimit),
          }),
        };
      } else {
        errorHandling = handleSendError(result.errorCode, 'errorMessage' in result ? result.errorMessage : undefined);
      }
      setErrorHandling(errorHandling);
      setIsUpdatingProposal(false);
      setProposedTotal(undefined);

      if (
        errorHandling.amountError
        || Object.keys(errorHandling).length === 0
      ) {
        setProposedFee(undefined);
      }
      setRecipientDisplayAddress('');
      setProposedAmount(undefined);
    }
  }, [convertToFiat, t]);

  const validateAndDisplayFee = useCallback((
    updateFiat: boolean = true,
  ) => {
    setErrorHandling({});
    setHighFeePercentage(undefined);
    setEstimatedClaimFee(undefined);
    setValid(false);
    lastProposal.current = null;
    if (proposeTimeout.current) {
      clearTimeout(proposeTimeout.current);
      proposeTimeout.current = null;
    }
    const txInput = getValidTxInputData();
    if (!txInput) {
      setProposedTotal(undefined);
      setIsUpdatingProposal(false);
      return;
    }
    setIsUpdatingProposal(true);
    // defer the transaction proposal
    proposeTimeout.current = setTimeout(async () => {
      let proposePromise: Promise<TSendProposalResult | undefined> | undefined;
      try {
        proposePromise = queueTxProposal<TSendProposalResult | undefined>(account.code, () => {
          if (proposePromise !== lastProposal.current) {
            return;
          }
          return isLightningRecipient
            ? postPrepareTopUp({
              sourceAccountCode: account.code,
              ...txInput,
            })
            : accountApi.proposeTx(account.code, {
              ...txInput,
              address: recipientInput,
              sendAll: txInput.sendAll ? 'yes' : 'no',
              paymentRequest: null,
              useHighestFee: false,
            });
        });
        // keep this as the last known proposal
        lastProposal.current = proposePromise;
        const result = await proposePromise;
        // continue only if this is the most recent proposal
        if (result && proposePromise === lastProposal.current) {
          txProposal(updateFiat, result);
        }
      } catch (error) {
        if (proposePromise === lastProposal.current) {
          setValid(false);
          setProposedTotal(undefined);
          setIsUpdatingProposal(false);
          alertUser(error instanceof Error ? error.message : t('genericError'));
          console.error('Failed to propose transaction:', error);
        }
      } finally {
        // cleanup regardless of success or failure
        if (proposePromise === lastProposal.current) {
          lastProposal.current = null;
        }
      }
    }, 400); // Delay the proposal by 400 ms
  }, [account.code, getValidTxInputData, isLightningRecipient, recipientInput, t, txProposal]);

  useEffect(() => {
    validateAndDisplayFee(updateFiat);
    return () => {
      if (proposeTimeout.current) {
        clearTimeout(proposeTimeout.current);
      }
      lastProposal.current = null;
    };
  }, [updateFiat, validateAndDisplayFee]);

  useEffect(() => {
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
        convertFromFiat(amount, fiatUnit);
      } else if (fiatAmount) {
        convertFromFiat(fiatAmount);
      }
      return;
    }

    if (currencyChanged) {
      const amountToConvert = sendAll ? (proposedAmount ? proposedAmount.amount : '') : amount;
      convertToFiat(amountToConvert);
    }
  }, [
    account.coinCode,
    defaultCurrency,
    amount,
    btcUnit,
    convertFromFiat,
    convertToFiat,
    fiatAmount,
    getValidTxInputData,
    prevDefaultCurrency,
    prevBtcUnit,
    proposedAmount,
    sendAll,
    validateAndDisplayFee,
  ]);

  const handleFeeTargetChange = (feeTarget: accountApi.TFeeTargetCode) => {
    setFeeTarget(feeTarget);
    setCustomFee('');
    setUpdateFiat(sendAll);
  };

  const handleFiatInput = (fiatAmount: string) => {
    setScanErrors(errors => ({ ...errors, amountError: undefined }));
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
    setScanErrors(errors => ({ ...errors, addressError: undefined }));
    lightning.reset();
    setRecipientInput(input.replace(/\s/g, ''));
    setRecipientDisplayAddress('');
    setUpdateFiat(true);
    setSelectedReceiverAccount(null);
  };

  const handleSendToLightning = () => {
    handleRecipientInputChange('');
    lightning.select();
  };


  const parseQRResult = async (input: string, isActive: () => boolean, onReset?: () => void) => {
    // Send the raw scan so the backend owns URI parsing, address checks, and amount units.
    let parsedInput;
    try {
      parsedInput = await accountApi.parsePaymentInput(account.code, input);
    } catch (error) {
      if (isActive()) {
        alertUser(t('unknownError', { errorMessage: String(error) }));
      }
      return;
    }
    if (!isActive()) {
      return;
    }
    if (!parsedInput.success) {
      alertUser(t(parsedInput.errorCode === 'accountMismatch'
        ? 'send.error.paymentRequestAccountMismatch'
        : 'invalidFormat'));
      return;
    }
    const { recipient, amount: qrAmount } = parsedInput;
    // Apply the backend's display-unit amount, including an explicit clear; omission keeps the entry.
    if (qrAmount !== undefined) {
      setAmount(qrAmount);
      setFiatAmount('');
    }
    onReset?.();
    lightning.reset();
    setScanErrors(handleSendError(parsedInput.validationError));
    setRecipientInput(recipient);
    setRecipientDisplayAddress('');
    setSelectedReceiverAccount(null);
    setSendAll(false);
    convertToFiat(qrAmount ?? amount);
    setUpdateFiat(true);
  };

  const handleCoinAmountChange = (amount: string) => {
    setScanErrors(errors => ({ ...errors, amountError: undefined }));
    convertToFiat(amount);
    setAmount(amount);
    setUpdateFiat(true);
  };

  const handleSendAllChange = (sendAll: boolean) => {
    setScanErrors(errors => ({ ...errors, amountError: undefined }));
    if (sendAll) {
      conversionRequest.current++;
    } else {
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

  if (isLightningRecipient && sendResult?.success) {
    return <TopUpSuccess />;
  }

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            variant="navigation"
            mobileBackButton
            onBack={onBack}
            title={isLightningRecipient ? t('lightning.topUp.title') : t('send.title', { accountName: account.coinName })}
          >
            <HideAmountsButton />
          </Header>
          <View>
            <ViewContent>
              <div className={style.sendHeader}>
                <div className={style.availableBalance}>
                  <Balance balance={balance} />
                </div>
                <SubTitle className={style.subTitle}>
                  {t('send.transactionDetails')}
                </SubTitle>
                <CoinControl
                  account={account}
                  onSelectedUTXOsChange={handleSelectedUTXOsChange}
                  onCoinControlDialogActiveChange={setUtxoDialogActive}
                />
              </div>
              <ResponsiveGrid className={style.sendForm}>
                <Column col="2">
                  {fixedRecipient === 'lightning' ? (
                    <Input
                      id="recipientAddress"
                      label={t('send.address.label')}
                      value={t('lightning.accountLabel')}
                      readOnly
                      error={addressError}
                      labelSection={!lightning.readyAccountCode ? <span>{t('loading')}</span> : undefined}
                    >
                      <Logo coinCode="lightning" alt="" className={style.recipientLogo} />
                    </Input>
                  ) : (
                    <ReceiverAddressInput
                      account={account}
                      activeAccounts={activeAccounts}
                      addressError={addressError}
                      onInputChange={handleRecipientInputChange}
                      onAccountChange={setSelectedReceiverAccount}
                      recipientAddress={isLightningRecipient ? t('lightning.accountLabel') : recipientInput}
                      lightningOption={lightning.available ? {
                        ready: !!lightning.readyAccountCode,
                        selected: isLightningRecipient,
                        onSelect: handleSendToLightning,
                      } : undefined}
                      parseQRResult={parseQRResult}
                    />
                  )}
                </Column>
                <Column>
                  <CoinInput
                    balance={balance}
                    onAmountChange={handleCoinAmountChange}
                    onSendAllChange={handleSendAllChange}
                    sendAll={sendAll}
                    amountError={amountError}
                    proposedAmount={proposedAmount}
                    amount={amount}
                    hasSelectedUTXOs={hasSelectedUTXOs()}
                  />
                </Column>
                <Column>
                  <FiatInput
                    onFiatChange={handleFiatInput}
                    disabled={sendAll}
                    error={isLightningRecipient ? undefined : amountError}
                    fiatAmount={fiatAmount}
                    label={defaultCurrency}
                  />
                </Column>
                <Column>
                  <FeeTargets
                    accountCode={account.code}
                    coinCode={account.coinCode}
                    disabled={!amount && !sendAll}
                    proposedFee={proposedFee}
                    highFeePercentage={highFeePercentage}
                    customFee={customFee}
                    showCalculatingFeeLabel={isUpdatingProposal}
                    onFeeTargetChange={handleFeeTargetChange}
                    onCustomFee={handleCustomFee}
                    error={errorHandling.feeError}
                    // value={feeTarget}
                  />
                  {isLightningRecipient && estimatedClaimFee !== undefined && (
                    <TopUpClaimFee amount={estimatedClaimFee} />
                  )}
                </Column>
                <Column>
                  <NoteInput
                    note={note}
                    onNoteChange={handleNodeChange}
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
                    <DesktopBackButton
                      enableEsc={!isConfirming && !utxoDialogActive}
                      onClick={onBack}
                    >
                      {t('button.back')}
                    </DesktopBackButton>
                  </ColumnButtons>
                </Column>
              </ResponsiveGrid>
            </ViewContent>
            <ConfirmSend
              note={note}
              hasSelectedUTXOs={hasSelectedUTXOs()}
              isConfirming={isConfirming}
              selectedUTXOs={selectedUTXOsRef.current}
              coinCode={account.coinCode}
              transactionDetails={{
                selectedReceiverAccountName: isLightningRecipient ? t('lightning.accountLabel') : selectedReceiverAccount?.name,
                selectedReceiverAccountNumber: selectedReceiverAccount?.accountNumber,
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
                onDone={onDone}
                onRetry={handleRetry}>
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
                  {(proposedAmount && proposedAmount.conversions && proposedAmount.conversions[defaultCurrency]) ? (
                    <FiatValue
                      amount={proposedAmount}
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
