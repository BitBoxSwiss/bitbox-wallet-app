// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getLightningBalance, postCloseWithdraw, postPrepareCloseWithdraw, type TCloseWithdrawQuote } from '@/api/lightning';
import { getReceiveAddressList, type AccountCode, type TAccount, type TAmountWithConversions, type TReceiveAddressList } from '@/api/account';
import { Header, Main } from '@/components/layout';
import { useMountedRef } from '@/hooks/mount';
import { CloseWithdrawConfirm } from './confirm-step';
import { CloseWithdrawFailure } from './failure-step';
import { CloseWithdrawSuccess } from './success-step';

type TStep = 'confirm' | 'failure' | 'partialFailure' | 'success';

type TProps = {
  activeAccounts: TAccount[];
};

type TPreparedQuote = TCloseWithdrawQuote & {
  destinationAccountCode: AccountCode;
  destinationReceiveScriptType: TAccount['receiveScriptType'];
};

export const LightningCloseWithdrawFunds = ({
  activeAccounts,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const btcAccounts = useMemo(
    () => activeAccounts.filter(account => account.active && account.coinCode === 'btc'),
    [activeAccounts]
  );
  const [destinationAccountCode, setDestinationAccountCode] = useState<AccountCode>(btcAccounts[0]?.code || '');
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState<TStep>('confirm');
  const [balance, setBalance] = useState<TAmountWithConversions>();
  const [quote, setQuote] = useState<TPreparedQuote>();
  const [destinationAddress, setDestinationAddress] = useState<string>();
  const [isClosing, setIsClosing] = useState(false);
  const [txID, setTxID] = useState<string>();
  const mounted = useMountedRef();
  const isClosingRef = useRef(false);
  const quoteRequest = useRef(0);
  const destinationAccount = btcAccounts.find(account => account.code === destinationAccountCode);
  const destinationReceiveScriptType = destinationAccount?.receiveScriptType;
  const quoteMatchesDestination = quote?.destinationAccountCode === destinationAccountCode
    && quote.destinationReceiveScriptType === destinationReceiveScriptType;
  const canClose = confirmed && !!quote && quoteMatchesDestination && !!destinationAddress && !isClosing;

  useEffect(() => {
    if (!btcAccounts.length) {
      setDestinationAccountCode('');
      return;
    }
    if (!destinationAccountCode || !btcAccounts.some(account => account.code === destinationAccountCode)) {
      setDestinationAccountCode(btcAccounts[0]?.code || '');
    }
  }, [btcAccounts, destinationAccountCode]);

  const loadQuote = useCallback(async () => {
    const currentRequest = ++quoteRequest.current;
    const quoteDestinationAccountCode = destinationAccountCode;
    const quoteDestinationReceiveScriptType = destinationReceiveScriptType;
    setQuote(undefined);
    setDestinationAddress(undefined);

    try {
      const lightningBalance = await getLightningBalance();
      if (!mounted.current || currentRequest !== quoteRequest.current) {
        return;
      }
      setBalance(lightningBalance.available);
      if (!lightningBalance.hasAvailable) {
        return;
      }
      if (!quoteDestinationAccountCode) {
        return;
      }
      const addressLists = await getReceiveAddressList(quoteDestinationAccountCode)();
      if (!mounted.current || currentRequest !== quoteRequest.current) {
        return;
      }
      const destinationAddressList = getDestinationAddressList(quoteDestinationReceiveScriptType, addressLists);
      const address = destinationAddressList?.addresses[0]?.address;
      if (!address) {
        throw new Error('No receive address available');
      }

      const preparedQuote = await postPrepareCloseWithdraw(address);
      if (!mounted.current || currentRequest !== quoteRequest.current) {
        return;
      }
      setDestinationAddress(address);
      setBalance(preparedQuote.balance);
      setQuote({
        ...preparedQuote,
        destinationAccountCode: quoteDestinationAccountCode,
        destinationReceiveScriptType: quoteDestinationReceiveScriptType,
      });
    } catch (error) {
      console.error('Failed to prepare Lightning wallet withdrawal', error);
      if (mounted.current && currentRequest === quoteRequest.current) {
        setStep('failure');
      }
    }
  }, [destinationAccountCode, destinationReceiveScriptType, mounted]);

  useEffect(() => {
    if (step !== 'confirm' || isClosing) {
      quoteRequest.current += 1;
      return;
    }
    loadQuote();
  }, [isClosing, loadQuote, step]);

  const closeWithdraw = useCallback(async () => {
    if (
      !destinationAddress
      || !quote
      || quote.destinationAccountCode !== destinationAccountCode
      || quote.destinationReceiveScriptType !== destinationReceiveScriptType
      || isClosingRef.current
    ) {
      return;
    }
    isClosingRef.current = true;
    quoteRequest.current += 1;
    setIsClosing(true);
    try {
      const result = await postCloseWithdraw(destinationAddress, quote.balanceSat, quote.feeSat);
      if (!mounted.current) {
        return;
      }
      setTxID(result.txId);
      setStep(result.walletClosed ? 'success' : 'partialFailure');
    } catch (error) {
      console.error('Failed to close Lightning wallet and withdraw funds', error);
      if (mounted.current) {
        setStep('failure');
      }
    } finally {
      isClosingRef.current = false;
      if (mounted.current) {
        setIsClosing(false);
      }
    }
  }, [destinationAccountCode, destinationAddress, destinationReceiveScriptType, mounted, quote]);

  const renderStep = () => {
    switch (step) {
    case 'confirm':
      return (
        <CloseWithdrawConfirm
          balance={balance}
          btcAccounts={btcAccounts}
          canClose={canClose}
          confirmed={confirmed}
          destinationAccountCode={destinationAccountCode}
          fee={quote?.fee}
          isClosing={isClosing}
          onCancel={() => navigate(-1)}
          onClose={closeWithdraw}
          onConfirmChange={() => setConfirmed(current => !current)}
          onDestinationAccountChange={(code) => {
            setConfirmed(false);
            setDestinationAccountCode(code);
          }}
        />
      );
    case 'failure':
    case 'partialFailure':
      return (
        <CloseWithdrawFailure
          partial={step === 'partialFailure'}
          onCancel={() => navigate('/settings/lightning-settings')}
          onTryAgain={() => {
            if (step === 'partialFailure') {
              navigate('/lightning/deactivate/');
              return;
            }
            setConfirmed(false);
            setStep('confirm');
          }}
        />
      );
    case 'success':
      return (
        <CloseWithdrawSuccess
          explorerURL={txID && destinationAccount ? `${destinationAccount.blockExplorerTxPrefix}${txID}` : undefined}
          onDone={() => navigate('/account-summary')}
        />
      );
    }
  };

  return (
    <Main>
      <Header title={t('lightning.settings.closeAndWithdrawFunds')} />
      {renderStep()}
    </Main>
  );
};

const getDestinationAddressList = (
  receiveScriptType: TAccount['receiveScriptType'],
  addressLists: TReceiveAddressList[] | null,
): TReceiveAddressList | undefined => {
  if (!addressLists?.length) {
    return undefined;
  }
  return addressLists.find(({ scriptType }) => scriptType === receiveScriptType)
    || addressLists.find(({ scriptType }) => scriptType === 'p2wpkh')
    || addressLists[0];
};
