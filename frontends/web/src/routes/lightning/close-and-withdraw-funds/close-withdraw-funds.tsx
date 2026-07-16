// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getLightningBalance, postCloseWithdraw, postPrepareCloseWithdraw, type TCloseWithdrawQuote } from '@/api/lightning';
import type { AccountCode, TAccount, TAmountWithConversions } from '@/api/account';
import { Button } from '@/components/forms';
import { Header, Main } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { useMountedRef } from '@/hooks/mount';
import { CloseWithdrawConfirm } from './confirm-step';
import { CloseWithdrawFailure } from './failure-step';
import { CloseWithdrawSuccess } from './success-step';

type TStep = 'confirm' | 'failure' | 'partialFailure' | 'success';

type TProps = {
  activeAccounts: TAccount[];
  hasAccounts: boolean;
};

type TPreparedQuote = TCloseWithdrawQuote & {
  destinationAccountCode: AccountCode;
};

export const LightningCloseWithdrawFunds = ({
  activeAccounts,
  hasAccounts,
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
  const [isClosing, setIsClosing] = useState(false);
  const [txID, setTxID] = useState<string>();
  const mounted = useMountedRef();
  const isClosingRef = useRef(false);
  const quoteRequest = useRef(0);
  const destinationAccount = btcAccounts.find(account => account.code === destinationAccountCode);
  const quoteMatchesDestination = quote?.destinationAccountCode === destinationAccountCode;
  const canClose = confirmed && !!quote && quoteMatchesDestination && !isClosing;

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
    setQuote(undefined);

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
      const preparedQuote = await postPrepareCloseWithdraw(quoteDestinationAccountCode);
      if (!mounted.current || currentRequest !== quoteRequest.current) {
        return;
      }
      setBalance(preparedQuote.balance);
      setQuote({
        ...preparedQuote,
        destinationAccountCode: quoteDestinationAccountCode,
      });
    } catch (error) {
      console.error('Failed to prepare Lightning wallet withdrawal', error);
      if (mounted.current && currentRequest === quoteRequest.current) {
        setStep('failure');
      }
    }
  }, [destinationAccountCode, mounted]);

  useEffect(() => {
    if (step !== 'confirm' || isClosing || !destinationAccountCode) {
      quoteRequest.current += 1;
      return;
    }
    loadQuote();
  }, [destinationAccountCode, isClosing, loadQuote, step]);

  const closeWithdraw = useCallback(async () => {
    if (
      !quote
      || quote.destinationAccountCode !== destinationAccountCode
      || isClosingRef.current
    ) {
      return;
    }
    isClosingRef.current = true;
    quoteRequest.current += 1;
    setIsClosing(true);
    try {
      const result = await postCloseWithdraw(destinationAccountCode, quote.balanceSat, quote.feeSat);
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
  }, [destinationAccountCode, mounted, quote]);

  const renderStep = () => {
    if (!btcAccounts.length) {
      const primaryAction = hasAccounts
        ? {
          label: t('manageAccounts.title'),
          route: '/settings/manage-accounts',
        }
        : {
          label: t('welcome.connect'),
          route: '/',
        };
      return (
        <View textCenter verticallyCentered>
          <ViewContent>
            <p>{t('lightning.topUp.noBitcoinAccounts')}</p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate(primaryAction.route)}>
              {primaryAction.label}
            </Button>
            <Button secondary onClick={() => navigate('/settings/lightning-settings')}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
    }

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
