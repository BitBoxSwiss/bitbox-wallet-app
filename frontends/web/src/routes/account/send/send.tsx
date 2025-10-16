/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023-2025 Shift Crypto AG
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

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TSelectedUTXOs } from './utxos';
import { useMountedRef } from '@/hooks/mount';
import * as accountApi from '@/api/account';
import { syncdone } from '@/api/accountsync';
import { convertFromCurrency, convertToCurrency, parseExternalBtcAmount } from '@/api/coins';
import { View, ViewContent } from '@/components/view/view';
import { alertUser } from '@/components/alert/Alert';
import { Balance } from '@/components/balance/balance';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { Amount } from '@/components/amount/amount';
import { FeeTargets } from './feetargets';
import { isBitcoinBased } from '@/routes/account/utils';
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
import style from './send.module.css';

type TProps = {
  account: accountApi.TAccount;
  activeCurrency: accountApi.Fiat;
};

const useAccountBalance = (accountCode: accountApi.AccountCode) => {
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
  }, [accountCode, updateBalance]);

  return balance;
};

export const Send = ({
  account,
  activeCurrency,
}: TProps) => {
  const { t } = useTranslation();

  const selectedUTXOsRef = useRef<TSelectedUTXOs>({});
  const [utxoDialogActive, setUtxoDialogActive] = useState(false);
  // in case there are multiple parallel tx proposals we can ignore all other but the last one
  const lastProposal = useRef<Promise<accountApi.TTxProposalResult> | null>(null);
  const proposeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recipientAddress, setRecipientAddress] = useState<string>('');
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

  const [updateFiat, setUpdateFiat] = useState<boolean>(true);

  const balance = useAccountBalance(account.code);

  const handleContinue = () => {
    setSendAll(false);
    setIsConfirming(false);
    setRecipientAddress('');
    setProposedAmount(undefined);
    setProposedFee(undefined);
    setProposedTotal(undefined);
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
      setIsConfirming(false);
    } catch (err) {
      console.error(err);
    } finally {
      // The following method allows pressing escape again.
      setIsConfirming(false);
    }
  }, [account.code, account.keystore.rootFingerprint, note]);

  const getValidTxInputData = useCallback((): Required<accountApi.TTxInput> | false => {
    if (
      !recipientAddress
      || feeTarget === undefined
      || (!sendAll && !amount)
      || (feeTarget === 'custom' && !customFee)
    ) {
      return false;
    }
    return {
      address: recipientAddress,
      amount,
      feeTarget,
      customFee,
      sendAll: (sendAll ? 'yes' : 'no'),
      selectedUTXOs: Object.keys(selectedUTXOsRef.current),
      paymentRequest: null,
      useHighestFee: false
    };
  }, [recipientAddress, feeTarget, sendAll, amount, customFee]);

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
      setErrorHandling({});
      setProposedFee(result.fee);
      setProposedAmount(result.amount);
      setProposedTotal(result.total);
      setIsUpdatingProposal(false);
      if (updateFiat) {
        convertToFiat(result.amount.amount);
      }
    } else {
      const errorHandling = txProposalErrorHandling(result.errorCode);
      setErrorHandling(errorHandling);
      setIsUpdatingProposal(false);

      if (
        errorHandling.amountError
        || Object.keys(errorHandling).length === 0
      ) {
        setProposedFee(undefined);
      }
    }
  }, [convertToFiat]);

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
    validateAndDisplayFee(updateFiat);
  }, [amount, customFee, feeTarget, fiatAmount, updateFiat, validateAndDisplayFee]);

  const handleFeeTargetChange = (feeTarget: accountApi.FeeTargetCode) => {
    setFeeTarget(feeTarget);
    setCustomFee('');
    setUpdateFiat(sendAll);
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

  const handleReceiverAddressInputChange = (recipientAddress: string) => {
    setRecipientAddress(recipientAddress);
    setUpdateFiat(true);
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
          setRecipientAddress(qrAddress);
          setSendAll(false);
          setFiatAmount('');
          setErrorHandling({ amountError: t('send.error.invalidAmount') });
          return;
        }
      } else {
        setAmount(qrAmount);
      }
    }
    setRecipientAddress(qrAddress);
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

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            title={<h2>{t('send.title', { accountName: account.coinName })}</h2>}
          >
            <HideAmountsButton />
          </Header>
          <View>
            <ViewContent>
              <div>
                <label className="labelXLarge">{t('send.availableBalance')}</label>
              </div>
              <Balance balance={balance} noRotateFiat/>
              <div className={`flex flex-row flex-between ${style.container || ''}`}>
                <label className="labelXLarge">{t('send.transactionDetails')}</label>
                <div className={style.coinControlButtonContainer}>
                  <CoinControl
                    account={account}
                    onSelectedUTXOsChange={handleSelectedUTXOsChange}
                    onCoinControlDialogActiveChange={setUtxoDialogActive}
                  />
                </div>
              </div>
              <Grid col="1">
                <Column>
                  <ReceiverAddressInput
                    accountCode={account.code}
                    addressError={errorHandling.addressError}
                    onInputChange={handleReceiverAddressInputChange}
                    recipientAddress={recipientAddress}
                    parseQRResult={parseQRResult}
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
                    // value={feeTarget}
                  />
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
                    <BackButton
                      enableEsc={!isConfirming && !utxoDialogActive}
                    >
                      {t('button.back')}
                    </BackButton>
                  </ColumnButtons>
                </Column>
              </Grid>
            </ViewContent>
            <ConfirmSend
              baseCurrencyUnit={activeCurrency}
              note={note}
              hasSelectedUTXOs={hasSelectedUTXOs()}
              isConfirming={isConfirming}
              selectedUTXOs={selectedUTXOsRef.current}
              coinCode={account.coinCode}
              transactionDetails={{
                proposedFee,
                proposedAmount,
                proposedTotal,
                customFee,
                feeTarget,
                recipientAddress,
                activeCurrency,
              }}
            />
            {sendResult && (
              <SendResult
                code={account.code}
                result={sendResult}
                onContinue={handleContinue}
                onRetry={handleRetry}>
                <p>
                  {(proposedAmount &&
                  <Amount alwaysShowAmounts amount={proposedAmount.amount} unit={proposedAmount.unit}/>) || 'N/A'}
                  {' '}
                  <span className={style.unit}>
                    {(proposedAmount && proposedAmount.unit) || 'N/A'}
                  </span>
                </p>
                {(proposedAmount && proposedAmount.conversions && proposedAmount.conversions[activeCurrency]) ? (
                  <FiatValue baseCurrencyUnit={activeCurrency} amount={proposedAmount.conversions[activeCurrency] || ''} />
                ) : null}
              </SendResult>
            )}
          </View>
        </Main>
      </GuidedContent>
      <SendGuide coinCode={account.coinCode} />
    </GuideWrapper>
  );
};
