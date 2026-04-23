// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getBalance,
  hasSwapPaymentRequest,
  proposeTx,
  sendTx,
  TBalance,
  type AccountCode,
  type TAccount,
  type TAmountWithConversions,
  type CoinUnit,
  type TSendTx,
} from '@/api/account';
import { convertToCurrency, parseExternalBtcAmount } from '@/api/coins';
import {
  getSwapAccounts,
  getSwapQuote,
  signSwap,
  type TSwapAccount,
  type TSwapQuoteRoute,
} from '@/api/swap';
import { FirmwareUpgradeRequiredDialog } from '@/components/dialog/firmware-upgrade-required-dialog';
import { GuideWrapper, GuidedContent, Main, Header } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SubTitle } from '@/components/title';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { alertUser } from '@/components/alert/Alert';
import { Message } from '@/components/message/message';
import { Button, Label } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Amount } from '@/components/amount/amount';
import { AmountUnit, AmountWithUnit } from '@/components/amount/amount-with-unit';
import { ArrowSwap } from '@/components/icon';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { findAccount, getDisplayedCoinUnit, isBitcoinOnly } from '@/routes/account/utils';
import { useLoad } from '@/hooks/api';
import { InputWithAccountSelector } from './components/input-with-account-selector';
import { SwapServiceSelector } from './components/swap-service-selector';
import { ConfirmSwap } from './components/swap-confirm';
import { SwapResult } from './components/swap-result';
import { RatesContext } from '@/contexts/RatesContext';
import { getConfig } from '@/utils/config';
import { useVendorTerms } from '@/hooks/vendor-iframe-terms';
import { SwapkitTerms } from '@/components/terms/swapkit-terms';
import { Skeleton } from '@/components/skeleton/skeleton';
import style from './swap.module.css';

type Props = {
  accounts: TAccount[];
};

const QUOTE_DEBOUNCE_MS = 300;

const fetchBalance = async (code: AccountCode) => {
  const response = await getBalance(code);
  if (response.success) {
    return response.balance;
  }
  return;
};

const getSwapDisplayAmount = async (
  amount: string,
  coinCode: TSwapAccount['coinCode'],
  coinUnit: CoinUnit,
  btcUnit: 'default' | 'sat' | undefined,
): Promise<{ amount: string; unit: CoinUnit }> => {
  const displayedUnit = getDisplayedCoinUnit(coinCode, coinUnit, btcUnit);
  if (displayedUnit === coinUnit || !isBitcoinOnly(coinCode)) {
    return { amount, unit: displayedUnit };
  }

  const parsedAmount = await parseExternalBtcAmount(amount);
  return {
    amount: parsedAmount.success ? parsedAmount.amount : amount,
    unit: displayedUnit,
  };
};

export const Swap = ({
  accounts,
}: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeCurrencies, btcUnit } = useContext(RatesContext);
  // accounts is added as a dependency, to reload swap accounts when the account list changes.
  const swapAccounts = useLoad(getSwapAccounts, [accounts]);
  const sellAccounts = swapAccounts?.success ? swapAccounts.sellAccounts : undefined;
  const buyAccounts = swapAccounts?.success ? swapAccounts.buyAccounts : undefined;

  // Send
  const [sellAccountCode, setSellAccountCode] = useState<AccountCode | undefined>();
  const [sellAmount, setSellAmount] = useState<string>('');
  const [maxSellAmount, setMaxSellAmount] = useState<TBalance | undefined>();

  // Receive
  const [buyAccountCode, setBuyAccountCode] = useState<AccountCode | undefined>();
  const [expectedOutput, setExpectedOutput] = useState<string>('');
  const [expectedOutputUnit, setExpectedOutputUnit] = useState<CoinUnit | undefined>();

  // Shows the fullscreen device-confirmation step after the tx proposal is ready.
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
  const [quoteErrorCode, setQuoteErrorCode] = useState<string | undefined>();
  const [routeError, setRouteError] = useState<string | undefined>();
  // Drives the button disabled/loading state for the whole confirm flow.
  const [isConfirmInFlight, setIsConfirmInFlight] = useState(false);
  // Prevents double-submit before the button disabled state has re-rendered.
  const confirmInFlightRef = useRef(false);

  const sellAccount = useMemo(
    () => sellAccountCode && sellAccounts
      ? findAccount(sellAccounts, sellAccountCode)
      : undefined,
    [sellAccounts, sellAccountCode],
  );
  const buyAccount = useMemo(
    () => buyAccountCode && buyAccounts
      ? findAccount(buyAccounts, buyAccountCode)
      : undefined,
    [buyAccounts, buyAccountCode],
  );

  const selectedRoute = useMemo(
    () => routes.find(route => route.routeId === selectedRouteId),
    [routes, selectedRouteId],
  );
  const sellDisplayUnit = useMemo(
    () => sellAccount
      ? getDisplayedCoinUnit(sellAccount.coinCode, sellAccount.coinUnit, btcUnit)
      : undefined,
    [btcUnit, sellAccount],
  );

  const config = useLoad(getConfig);
  const { agreedTerms, setAgreedTerms } = useVendorTerms(!!config?.frontend?.skipSwapkitDisclaimer);

  const isSameCoinAccount = (
    candidate: TSwapAccount,
    oppositeAccount: TSwapAccount | undefined,
  ) => candidate.coinCode === oppositeAccount?.coinCode;

  // Keeps the selected swap accounts aligned with the latest available options and redirects away if no swap is possible.
  useEffect(() => {
    if (!swapAccounts || !swapAccounts.success) {
      return;
    }
    if (swapAccounts.sellAccounts.length === 0 || swapAccounts.buyAccounts.length === 0) {
      navigate('/market/select', { replace: true });
      return;
    }
    if (!swapAccounts.sellAccounts.some(account => account.code === sellAccountCode)) {
      setSellAccountCode(
        swapAccounts.defaultSellAccountCode && swapAccounts.sellAccounts.some(
          account => account.code === swapAccounts.defaultSellAccountCode,
        )
          ? swapAccounts.defaultSellAccountCode
          : swapAccounts.sellAccounts[0]?.code,
      );
    }
    const selectedSellAccount = swapAccounts.sellAccounts.find(account => account.code === sellAccountCode);
    if (!swapAccounts.buyAccounts.some(account => account.code === buyAccountCode)) {
      setBuyAccountCode(
        swapAccounts.defaultBuyAccountCode && swapAccounts.buyAccounts.some(
          account => account.code === swapAccounts.defaultBuyAccountCode
            && !isSameCoinAccount(account, selectedSellAccount),
        )
          ? swapAccounts.defaultBuyAccountCode
          : swapAccounts.buyAccounts.find(account => !isSameCoinAccount(account, selectedSellAccount))?.code,
      );
    }
  }, [buyAccountCode, navigate, sellAccountCode, swapAccounts]);

  // enable flip button
  useEffect(() => {
    setCanFlip(
      buyAccount?.active === true
      && sellAccountCode !== undefined
    );
  }, [buyAccount, sellAccountCode]);

  const clearQuoteState = (error?: string, errorCode?: string) => {
    setRoutes([]);
    setSelectedRouteId(undefined);
    setExpectedOutput('');
    setExpectedOutputUnit(undefined);
    setQuoteErrorCode(errorCode);
    setRouteError(error);
  };

  // flips sell and buy account
  const handleFlipAccounts = () => {
    if (buyAccountCode && sellAccountCode) {
      clearQuoteState();
      setSellAccountCode(buyAccountCode);
      setSellAmount(expectedOutput);
      setBuyAccountCode(sellAccountCode);
    }
  };

  // update max swappable amount (total coins of the account)
  useEffect(() => {
    if (sellAccountCode) {
      fetchBalance(sellAccountCode).then(setMaxSellAmount);
    }
  }, [sellAccountCode]);

  // fetch swap quotes whenever the selected pair or sell amount changes.
  useEffect(() => {
    let isCancelled = false;
    const sellCoinCode = sellAccount?.coinCode;
    const buyCoinCode = buyAccount?.coinCode;
    const amount = Number(sellAmount);

    setRoutes([]);
    setSelectedRouteId(undefined);
    setExpectedOutput('');
    setExpectedOutputUnit(undefined);

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
    setQuoteErrorCode(undefined);
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
          setQuoteErrorCode(undefined);
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
            ? t('swap.noRouteFound')
            : response.errorCode === 'insufficientFunds'
              ? undefined
              : response.errorMessage,
          response.success ? undefined : response.errorCode,
        );
      } catch (error: unknown) {
        if (isCancelled) {
          return;
        }
        clearQuoteState(
          typeof error === 'string' && error
            ? error
            : t('swap.fetchQuotesError'),
        );
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
  }, [buyAccount?.coinCode, buyAccountCode, sellAccount?.coinCode, sellAccountCode, sellAmount, t]);

  useEffect(() => {
    let canceled = false;

    const updateExpectedOutput = async () => {
      if (!selectedRoute || !buyAccount) {
        setExpectedOutput('');
        setExpectedOutputUnit(undefined);
        return;
      }

      const displayAmount = await getSwapDisplayAmount(
        selectedRoute.expectedBuyAmount,
        buyAccount.coinCode,
        buyAccount.coinUnit,
        btcUnit,
      );
      if (canceled) {
        return;
      }
      setExpectedOutput(displayAmount.amount);
      setExpectedOutputUnit(displayAmount.unit);
    };

    updateExpectedOutput().catch(() => {
      if (!canceled) {
        setExpectedOutput(selectedRoute?.expectedBuyAmount || '');
        setExpectedOutputUnit(buyAccount?.coinUnit);
      }
    });

    return () => {
      canceled = true;
    };
  }, [btcUnit, buyAccount, selectedRoute]);

  const handleConfirm = async () => {
    if (confirmInFlightRef.current) {
      return;
    }

    confirmInFlightRef.current = true;
    setIsConfirmInFlight(true);

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

      let expectedOutputConversions: TAmountWithConversions['conversions'];
      const fiatConversions = await Promise.all(
        activeCurrencies.map(async fiatUnit => {
          const fiatConversion = await convertToCurrency({
            amount: response.expectedBuyAmount,
            coinCode: buyAccount.coinCode,
            fiatUnit,
          });
          return fiatConversion.success
            ? [fiatUnit, fiatConversion.fiatAmount] as const
            : undefined;
        }),
      );
      expectedOutputConversions = Object.fromEntries(
        fiatConversions.filter(entry => entry !== undefined),
      );

      setConfirmDetails({
        expectedOutput: {
          amount: expectedOutput,
          conversions: expectedOutputConversions,
          unit: expectedOutputUnit || buyAccount.coinUnit,
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
      confirmInFlightRef.current = false;
      setIsConfirmInFlight(false);
      setIsConfirming(false);
    }
  };

  if (
    swapAccounts?.success === false
    || swapAccounts?.sellAccounts.length === 0
  ) {
    return (
      <GuideWrapper>
        <GuidedContent>
          <Main>
            <Header
              hideSidebarToggler
              title={
                <SubTitle>
                  {t('generic.swap')}
                </SubTitle>
              }
            />
            <View
              fullscreen={false}
              width="600px">
              <ViewContent
                textAlign="center"
                withIcon="error">
                <p>
                  {t('genericError')}
                </p>
              </ViewContent>
              <ViewButtons>
                <BackButton>
                  {t('button.back')}
                </BackButton>
              </ViewButtons>
            </View>
          </Main>
        </GuidedContent>
      </GuideWrapper>
    );
  }

  if (!agreedTerms) {
    return (
      <GuideWrapper>
        <GuidedContent>
          <Main>
            <Header
              hideSidebarToggler
              title={
                <SubTitle>
                  {t('generic.swap')}
                </SubTitle>
              }
            />
            <SwapkitTerms
              onAgreedTerms={() => setAgreedTerms(true)}
            />
          </Main>
        </GuidedContent>
      </GuideWrapper>
    );
  }

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
                {t('generic.swap')}
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
                  <span className={style.max}>
                    {t('generic.max')}
                    {' '}
                    <AmountWithUnit amount={maxSellAmount.available} />
                  </span>
                )}
              </div>
              {!sellAccounts || !sellAccountCode ? (
                <Skeleton />
              ) : (
                <InputWithAccountSelector
                  accounts={sellAccounts}
                  id="swapSendAmount"
                  accountCode={sellAccountCode}
                  isAccountDisabled={account => isSameCoinAccount(account, buyAccount)}
                  onChangeAccountCode={setSellAccountCode}
                  value={sellAmount}
                  onChangeValue={setSellAmount}
                />
              )}
              <Message
                hidden={quoteErrorCode !== 'insufficientFunds'}
                type="warning"
                className={style.sellWarning}
              >
                {sellDisplayUnit}
                {': '}
                {t('send.error.insufficientFunds')}
              </Message>
              <div className={style.flipContainer}>
                <Button
                  disabled={!canFlip}
                  transparent
                  className={style.flipAccountsButton}
                  onClick={handleFlipAccounts}
                >
                  <ArrowSwap className={style.flipAccountsIcon} />
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
                  <span className={style.max}>
                    <Amount
                      amount={expectedOutput}
                      unit={expectedOutputUnit || buyAccount.coinUnit}
                    />
                    <AmountUnit
                      unit={expectedOutputUnit || buyAccount.coinUnit}
                    />
                  </span>
                )}
              </div>
              {!buyAccounts || !buyAccountCode ? (
                <Skeleton />
              ) : (
                <InputWithAccountSelector
                  accounts={buyAccounts}
                  id="swapGetAmount"
                  accountCode={buyAccountCode}
                  isAccountDisabled={account => isSameCoinAccount(account, sellAccount)}
                  onChangeAccountCode={setBuyAccountCode}
                  value={expectedOutput}
                  readOnlyAmount
                />
              )}
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
              <Button
                primary
                disabled={!selectedRoute || isConfirmInFlight}
                onClick={handleConfirm}>
                <span className={style.swapButtonContent}>
                  {isConfirmInFlight && (
                    <span className={style.swapButtonSpinner}>
                      <SpinnerRingAnimated />
                    </span>
                  )}
                  {isConfirmInFlight ? t('loading') : t('generic.swap')}
                </span>
              </Button>
              <BackButton>
                {t('button.back')}
              </BackButton>
            </ViewButtons>
          </View>

          {confirmDetails && (
            <ConfirmSwap
              isConfirming={isConfirming}
              expectedOutput={confirmDetails.expectedOutput}
              feeAmount={confirmDetails.feeAmount}
              sellAmount={confirmDetails.sellAmount}
            />
          )}

          {buyAccountCode && (
            <SwapResult
              buyAccountCode={buyAccountCode}
              buyEthAccountCode={sellAccount?.parentAccountCode ?? sellAccount?.code}
              onContinue={() => {
                setIsConfirming(false);
                setResult(undefined);
                setConfirmDetails(undefined);
              }}
              result={result}
            />
          )}

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
