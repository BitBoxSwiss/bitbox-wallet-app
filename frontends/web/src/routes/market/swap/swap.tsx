// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getBalance,
  getSwapDestinationAccounts,
  hasSwapPaymentRequest,
  proposeTx,
  sendTx,
  TBalance,
  type AccountCode,
  type TAccount,
  type TAmountWithConversions,
  type TSendTx,
  type TSwapDestinationAccount,
} from '@/api/account';
import { getSwapQuote, signSwap, type TSwapQuoteRoute } from '@/api/swap';
import { FirmwareUpgradeRequiredDialog } from '@/components/dialog/firmware-upgrade-required-dialog';
import { GuideWrapper, GuidedContent, Main, Header } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SubTitle } from '@/components/title';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { alertUser } from '@/components/alert/Alert';
import { Button, Label } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Amount } from '@/components/amount/amount';
import { AmountUnit, AmountWithUnit } from '@/components/amount/amount-with-unit';
import { ArrowSwap } from '@/components/icon';
import { findAccount } from '@/routes/account/utils';
import { useLoad } from '@/hooks/api';
import { InputWithAccountSelector } from './components/input-with-account-selector';
import { SwapServiceSelector } from './components/swap-service-selector';
import { ConfirmSwap } from './components/swap-confirm';
import { SwapResult } from './components/swap-result';
import style from './swap.module.css';

type Props = {
  accounts: TAccount[];
  code: AccountCode;
};

const QUOTE_DEBOUNCE_MS = 300;
const FALLBACK_FETCH_ERROR = 'Unable to fetch quotes right now. Please try again.';

const fetchBalance = async (code: AccountCode) => {
  const response = await getBalance(code);
  if (response.success) {
    return response.balance;
  }
  return;
};

export const Swap = ({
  accounts,
  code,
}: Props) => {
  const { t } = useTranslation();
  const loadedBuyAccounts = useLoad(getSwapDestinationAccounts, [accounts]);
  const buyAccounts = useMemo<TSwapDestinationAccount[]>(
    () => loadedBuyAccounts || [],
    [loadedBuyAccounts],
  );

  // Send
  const [sellAccountCode, setSellAccountCode] = useState<AccountCode>(code);
  const [sellAmount, setSellAmount] = useState<string>('');
  const [maxSellAmount, setMaxSellAmount] = useState<TBalance | undefined>();

  // Receive
  const [buyAccountCode, setBuyAccountCode] = useState<AccountCode | undefined>();
  const [expectedOutput, setExpectedOutput] = useState<string>('');

  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [confirmDetails, setConfirmDetails] = useState<{
    expectedOutput: TAmountWithConversions;
    feeAmount: TAmountWithConversions;
    sellAmount: TAmountWithConversions;
  }>();
  const [result, setResult] = useState<TSendTx | undefined>();
  const [canFlip, setCanFlip] = useState<boolean>(false);
  const [fwRequiredDialog, setFwRequiredDialog] = useState(false);

  const [routes, setRoutes] = useState<TSwapQuoteRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [isFetchingRoutes, setIsFetchingRoutes] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | undefined>();

  const fromAccount = useMemo(
    () => findAccount(accounts, sellAccountCode),
    [accounts, sellAccountCode],
  );
  const buyAccount = useMemo(
    () => buyAccountCode
      ? findAccount(buyAccounts, buyAccountCode)
      : undefined,
    [buyAccounts, buyAccountCode],
  );
  const selectedRoute = useMemo(
    () => routes.find(route => route.routeId === selectedRouteId),
    [routes, selectedRouteId],
  );

  // enable flip button
  useEffect(() => {
    setCanFlip(
      buyAccount?.active === true
      && sellAccountCode !== undefined
    );
  }, [buyAccount, sellAccountCode]);

  const clearQuoteState = (error?: string) => {
    setRoutes([]);
    setSelectedRouteId(undefined);
    setExpectedOutput('');
    setRouteError(error);
  };

  // flips sell and buy account
  const handleFlipAccounts = () => {
    if (buyAccountCode && sellAccountCode) {
      setSellAccountCode(buyAccountCode);
      setSellAmount(expectedOutput);
      setBuyAccountCode(sellAccountCode);
      setExpectedOutput(sellAmount);
    }
  };

  // update max swappable amount (total coins of the account)
  useEffect(() => {
    if (sellAccountCode) {
      fetchBalance(sellAccountCode).then(setMaxSellAmount);
    }
  }, [sellAccountCode]);

  useEffect(() => {
    let isCancelled = false;
    const sellCoinCode = fromAccount?.coinCode;
    const buyCoinCode = buyAccount?.coinCode;
    const amount = Number(sellAmount);

    if (
      !sellCoinCode
      || !buyCoinCode
      || !sellAmount
      || Number.isNaN(amount)
      || amount <= 0
      || sellAccountCode === buyAccountCode
    ) {
      clearQuoteState();
      setIsFetchingRoutes(false);
      return;
    }

    setIsFetchingRoutes(true);
    setRouteError(undefined);

    const fetchRoutes = async () => {
      try {
        const response = await getSwapQuote({
          buyCoinCode,
          sellAccountCode,
          sellAmount,
          sellCoinCode,
        });
        if (isCancelled) {
          return;
        }
        const nextRoutes = response.success ? response.quote.routes : [];
        if (nextRoutes.length > 0) {
          setRoutes(nextRoutes);
          const firstRouteId = nextRoutes[0]?.routeId;
          setSelectedRouteId(currentRouteId => (
            nextRoutes.some(route => route.routeId === currentRouteId)
              ? currentRouteId
              : firstRouteId
          ));
          return;
        }
        clearQuoteState(
          response.success
            ? 'no route found'
            : response.errorMessage || 'Some unexpected error occurred.',
        );
      } catch (error: unknown) {
        if (isCancelled) {
          return;
        }
        clearQuoteState(typeof error === 'string' && error ? error : FALLBACK_FETCH_ERROR);
      } finally {
        if (!isCancelled) {
          setIsFetchingRoutes(false);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      fetchRoutes();
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [buyAccount?.coinCode, buyAccountCode, fromAccount?.coinCode, sellAccountCode, sellAmount]);

  useEffect(() => {
    setExpectedOutput(selectedRoute?.expectedBuyAmount || '');
  }, [selectedRoute]);

  const handleConfirm = async () => {
    try {
      if (!buyAccountCode || !sellAccountCode || !selectedRouteId || !sellAmount || !buyAccount) {
        alertUser(t('genericError'));
        return;
      }

      const paymentRequestSupport = await hasSwapPaymentRequest(sellAccountCode);
      if (!paymentRequestSupport.success) {
        if (paymentRequestSupport.errorCode === 'firmwareUpgradeRequired') {
          setFwRequiredDialog(true);
        } else if (paymentRequestSupport.errorCode) {
          alertUser(t(`device.${paymentRequestSupport.errorCode}`));
        } else {
          alertUser(paymentRequestSupport.errorMessage || t('genericError'));
        }
        return;
      }

      setResult(undefined);
      setConfirmDetails(undefined);

      const response = await signSwap({
        buyAccountCode,
        routeId: selectedRouteId,
        sellAccountCode,
        sellAmount,
      });
      if (!response.success) {
        alertUser(response.errorMessage || t('genericError'));
        return;
      }

      const proposal = await proposeTx(sellAccountCode, response.txInput);
      if (!proposal.success) {
        if (proposal.errorCode) {
          alertUser(t(`send.error.${proposal.errorCode}`));
        } else {
          alertUser(t('genericError'));
        }
        return;
      }

      setConfirmDetails({
        expectedOutput: {
          amount: response.expectedBuyAmount,
          unit: buyAccount.coinUnit,
          estimated: false,
        },
        feeAmount: proposal.fee,
        sellAmount: proposal.amount,
      });
      setIsConfirming(true);

      const recipientName = response.txInput.paymentRequest?.recipientName || 'SwapKit';
      const sendResult = await sendTx(sellAccountCode, `${t('generic.swap')} ${recipientName}`);
      setResult(sendResult);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';
      alertUser(errorMessage || t('genericError'));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <FirmwareUpgradeRequiredDialog
          open={fwRequiredDialog}
          onClose={() => setFwRequiredDialog(false)}
        />
        <Main>
          <Header
            hideSidebarToggler
            title={
              <SubTitle>
                Swap
              </SubTitle>
            }
          />
          <View
            fullscreen={false}
            width="600px"
          >
            <ViewContent>
              <div className={style.row}>
                <Label
                  className={style.label}
                  htmlFor="swapSendAmount">
                  <span>
                    {t('generic.send')}
                  </span>
                </Label>
                {maxSellAmount && (
                  <Button transparent className={style.maxButton}>
                    Max
                    {' '}
                    <AmountWithUnit amount={maxSellAmount.available} />
                  </Button>
                )}
              </div>
              <InputWithAccountSelector
                accounts={accounts}
                id="swapSendAmount"
                accountCode={sellAccountCode}
                onChangeAccountCode={setSellAccountCode}
                value={sellAmount}
                onChangeValue={setSellAmount}
              />
              <div className={style.flipContainer}>
                <Button
                  disabled={!canFlip}
                  transparent
                  className={style.flipAcconutsButton}
                  onClick={handleFlipAccounts}
                >
                  <ArrowSwap className={style.flipAcconutsIcon} />
                </Button>
              </div>
              <div className={style.row}>
                <Label
                  htmlFor="swapGetAmount">
                  <span>
                    {t('generic.receiveWithoutCoinCode')}
                  </span>
                </Label>
                {selectedRoute && buyAccount && (
                  <Button transparent className={style.maxButton}>
                    <Amount
                      amount={expectedOutput}
                      unit={buyAccount.coinUnit}
                    />
                    <AmountUnit
                      unit={buyAccount.coinUnit}
                    />
                  </Button>
                )}
              </div>
              <InputWithAccountSelector
                accounts={buyAccounts}
                id="swapGetAmount"
                accountCode={buyAccountCode}
                onChangeAccountCode={setBuyAccountCode}
                value={expectedOutput}
              />
              <SwapServiceSelector
                buyUnit={buyAccount?.coinUnit}
                error={routeError}
                isLoading={isFetchingRoutes}
                onChangeRouteId={setSelectedRouteId}
                routes={routes}
                selectedRouteId={selectedRouteId}
              />
            </ViewContent>
            <ViewButtons>
              <Button primary disabled={!selectedRoute} onClick={handleConfirm}>
                {t('generic.swap')}
              </Button>
              <BackButton>
                {t('button.back')}
              </BackButton>
            </ViewButtons>
          </View>

          <ConfirmSwap
            isConfirming={isConfirming}
            expectedOutput={confirmDetails?.expectedOutput}
            feeAmount={confirmDetails?.feeAmount}
            sellAmount={confirmDetails?.sellAmount}
          />

          <SwapResult
            buyAccountCode={buyAccountCode || code}
            onContinue={() => {
              setIsConfirming(false);
              setResult(undefined);
              setConfirmDetails(undefined);
            }}
            result={result}
          />

        </Main>
      </GuidedContent>
      <Guide>
        <Entry
          key="guide.settings.servers"
          entry={{
            text: t('guide.settings.servers.text'),
            title: t('guide.settings.servers.title'),
          }}
        />
      </Guide>
    </GuideWrapper>
  );
};
