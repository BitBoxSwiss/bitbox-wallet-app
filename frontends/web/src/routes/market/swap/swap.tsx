// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useLocation } from 'wouter';
import {
  getBalance,
  proposeTx,
  sendTx,
  TBalance,
  type TAccountCode,
  type TAmountWithConversions,
  type TCoinUnit,
  type TSendTx,
} from '@/api/account';
import { convertToCurrency, parseExternalBtcAmount } from '@/api/coins';
import {
  getSwapAccounts,
  getSwapQuote,
  getSwapStatus,
  signSwap,
  type TSwapAccount,
  type TSwapAccounts,
  type TSwapQuoteErrorCode,
  type TSwapQuoteResponse,
  type TSwapQuoteValidationErrorCode,
} from '@/api/swap';
import { useAppState } from '@/contexts/app-state-context';
import { AppContext } from '@/contexts/AppContext';
import { GuideWrapper, GuidedContent, Main, Header } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { alertUser } from '@/components/alert/Alert';
import { Message } from '@/components/message/message';
import { Button, Label } from '@/components/forms';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { ArrowSwap } from '@/components/icon';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { findAccount } from '@/routes/account/utils';
import { getDisplayedCoinUnit, isBitcoinBased, isBitcoinOnly } from '@/utils/coin';
import { useLoad } from '@/hooks/api';
import { useAccountStatuses } from '@/hooks/account-status';
import { useFeatureConnect } from '@/hooks/keystore';
import { InputWithAccountSelector } from './components/input-with-account-selector';
import { SwapServiceSelector } from './components/swap-service-selector';
import { SwapProviderErrors } from './components/swap-provider-errors';
import { ConfirmSwap } from './components/swap-confirm';
import { SwapResult } from './components/swap-result';
import { RatesContext } from '@/contexts/RatesContext';
import { useConfig } from '@/contexts/ConfigProvider';
import { SwapkitTerms } from '@/components/terms/swapkit-terms';
import { TermsLink } from '@/components/terms/terms-link';
import { Skeleton } from '@/components/skeleton/skeleton';
import style from './swap.module.css';

const QUOTE_DEBOUNCE_MS = 300;
const INSUFFICIENT_FUNDS_ERROR: TSwapQuoteValidationErrorCode = 'insufficientFunds';
const NO_ROUTES_FOUND_ERROR: TSwapQuoteErrorCode = 'noRoutesFound';
const PROVIDERS_UNAVAILABLE_ERROR: TSwapQuoteErrorCode = 'providersUnavailable';
const UNEXPECTED_ERROR: TSwapQuoteErrorCode = 'unexpectedError';

const fetchBalance = async (code: TAccountCode) => {
  const response = await getBalance(code);
  if (response.success) {
    return response.balance;
  }
  return;
};

const getSwapDisplayAmount = async (
  amount: string,
  coinCode: TSwapAccount['coinCode'],
  coinUnit: TCoinUnit,
  btcUnit: 'default' | 'sat' | undefined,
): Promise<{ amount: string; unit: TCoinUnit }> => {
  const displayedUnit = getDisplayedCoinUnit(coinCode, coinUnit, btcUnit);
  if (displayedUnit === coinUnit || !isBitcoinOnly(coinCode)) {
    return { amount, unit: displayedUnit };
  }

  const parsedAmount = await parseExternalBtcAmount(amount);
  return {
    amount: parsedAmount.success ? parsedAmount.amount : amount,
    unit: parsedAmount.success ? displayedUnit : coinUnit,
  };
};

const getQuoteErrorMessage = (result: TSwapQuoteResponse | string | undefined, t: TFunction) => {
  if (result === undefined || typeof result === 'string') {
    return result;
  }
  if (result.success && result.quote.routes.length) {
    return;
  }
  if (!result.success && result.quoteErrorCode === PROVIDERS_UNAVAILABLE_ERROR) {
    return t('swap.providersUnavailable');
  }

  const providerErrors = result.quote?.providerErrors;
  if (result.success || result.quoteErrorCode === NO_ROUTES_FOUND_ERROR || providerErrors?.length) {
    const pair = result.success ? undefined : result.errorData;
    const noRouteMessage = (
      pair?.sellCoin && pair.buyCoin
        ? t('swap.noRouteFoundForPair', pair)
        : t('swap.noRouteFound')
    );
    return providerErrors?.length
      ? <SwapProviderErrors errors={providerErrors} noRouteMessage={noRouteMessage} />
      : noRouteMessage;
  }
  return result.quoteErrorCode === UNEXPECTED_ERROR
    ? t('swap.fetchQuotesError')
    : result.errorMessage || t('swap.fetchQuotesError');
};

export const Swap = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { accounts, devices, deviceIDs } = useAppState();
  const { setFirmwareUpdateDialogOpen } = useContext(AppContext);
  const [swapStatusLoadAttempt, setSwapStatusLoadAttempt] = useState(0);
  // null marks a failed check; undefined remains the loading state.
  const swapStatus = useLoad(
    () => getSwapStatus().catch(() => null),
    [accounts, devices, swapStatusLoadAttempt],
  );
  const {
    connect,
    dismissFirmwareUpgrade,
    firmwareUpgradeRequired: signingFirmwareUpgradeRequired,
  } = useFeatureConnect();
  useEffect(dismissFirmwareUpgrade, [accounts, devices, dismissFirmwareUpgrade]);
  const firmwareUpgradeRequired = swapStatus?.firmwareUpgradeRequired || signingFirmwareUpgradeRequired;
  const firmwareDeviceID = deviceIDs.find(deviceID => devices[deviceID] === 'bitbox02');
  const { activeCurrencies, btcUnit, defaultCurrency } = useContext(RatesContext);
  // accounts is added as a dependency, to reload swap accounts when the account list changes.
  const loadedSwapAccounts = useLoad(getSwapAccounts, [accounts]);
  const [retainedSwapAccounts, setRetainedSwapAccounts] = useState<TSwapAccounts>();
  useEffect(() => {
    if (loadedSwapAccounts !== undefined) {
      setRetainedSwapAccounts(loadedSwapAccounts);
    }
  }, [loadedSwapAccounts]);
  const swapAccounts = loadedSwapAccounts ?? retainedSwapAccounts;
  const sellAccounts = swapAccounts?.success ? swapAccounts.sellAccounts : undefined;
  const buyAccounts = swapAccounts?.success ? swapAccounts.buyAccounts : undefined;

  // BTC/LTC need sync to identify unused addresses. ETH/token addresses only need initialization,
  // and inactive tokens do not have a live account until swap preparation activates them.
  const syncAccountCodes = useMemo(
    () => buyAccounts?.filter(account => isBitcoinBased(account.coinCode)).map(account => account.code) ?? [],
    [buyAccounts],
  );
  const accountStatuses = useAccountStatuses(syncAccountCodes);
  const isBuyAccountSyncing = useCallback(
    (account: TSwapAccount) => isBitcoinBased(account.coinCode) && !accountStatuses[account.code]?.synced,
    [accountStatuses],
  );

  // Send
  const [sellAccountCode, setSellAccountCode] = useState<TAccountCode | undefined>();
  const [sellAmount, setSellAmount] = useState<string>('');
  const [maxSellAmount, setMaxSellAmount] = useState<TBalance | undefined>();

  // Receive
  const [buyAccountCode, setBuyAccountCode] = useState<TAccountCode | undefined>();
  const [expectedOutput, setExpectedOutput] = useState<string>('');
  const [expectedOutputUnit, setExpectedOutputUnit] = useState<TCoinUnit | undefined>();

  // Shows the fullscreen device-confirmation step after the tx proposal is ready.
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [confirmDetails, setConfirmDetails] = useState<{
    expectedOutput: TAmountWithConversions;
    feeAmount: TAmountWithConversions;
    sellAmount: TAmountWithConversions;
  }>();
  const [result, setResult] = useState<TSendTx | undefined>();
  const [canFlip, setCanFlip] = useState<boolean>(false);
  const [quoteResult, setQuoteResult] = useState<TSwapQuoteResponse | string>();
  const quoteResponse = typeof quoteResult === 'object' ? quoteResult : undefined;
  const routes = quoteResponse?.success ? quoteResponse.quote.routes : undefined;
  const validationErrorCode = quoteResponse?.validationErrorCode;
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [isFetchingRoutes, setIsFetchingRoutes] = useState<boolean>(false);
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
  const buyAccountSyncing = !!buyAccount && isBuyAccountSyncing(buyAccount);

  const selectedRoute = useMemo(
    () => routes?.find(route => route.routeId === selectedRouteId),
    [routes, selectedRouteId],
  );
  const sellParentAccount = (
    sellAccount?.isToken
      ? accounts.find(account => account.code === sellAccount.parentAccountCode)
      : undefined
  );
  const insufficientGasFunds = sellAccount?.isToken === true && selectedRoute?.insufficientGasFunds === true;
  const sellDisplayUnit = useMemo(
    () => sellAccount
      ? getDisplayedCoinUnit(sellAccount.coinCode, sellAccount.coinUnit, btcUnit)
      : undefined,
    [btcUnit, sellAccount],
  );

  const { config } = useConfig();
  const agreedTerms = config?.frontend.skipSwapkitDisclaimer ?? false;

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

  const clearQuoteState = useCallback(() => {
    setQuoteResult(undefined);
    setSelectedRouteId(undefined);
    setExpectedOutput('');
    setExpectedOutputUnit(undefined);
  }, []);

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

  // Changing the sell unit also changes how the backend interprets the entered amount.
  useEffect(() => {
    let isCancelled = false;
    const sellCode = sellAccount?.code;
    const buyCoinCode = buyAccount?.coinCode;
    const amount = Number(sellAmount);

    clearQuoteState();

    if (
      !sellCode
      || !buyCoinCode
      || !sellAmount
      || Number.isNaN(amount)
      || amount <= 0
      || sellCode === buyAccountCode
    ) {
      setIsFetchingRoutes(false);
      return;
    }

    setIsFetchingRoutes(true);
    const fetchRoutes = async () => {
      try {
        const response = await getSwapQuote({
          buyCoinCode,
          sellAccountCode: sellCode,
          sellAmount,
        });
        if (isCancelled) {
          return;
        }
        setQuoteResult(response);
        if (response.success && response.quote.routes.length) {
          const nextRoutes = response.quote.routes;
          const firstRouteId = nextRoutes[0]?.routeId;
          setSelectedRouteId(currentRouteId => (
            nextRoutes.some(route => route.routeId === currentRouteId)
              ? currentRouteId
              : firstRouteId
          ));
        }
      } catch (error: unknown) {
        if (isCancelled) {
          return;
        }
        setQuoteResult(
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
  }, [
    buyAccount?.coinCode,
    buyAccountCode,
    clearQuoteState,
    sellAccount?.code,
    sellAmount,
    sellDisplayUnit,
    t,
  ]);

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
    if (
      confirmInFlightRef.current || buyAccountSyncing || !sellAccount
      || swapStatus?.connectedKeystore !== 'multi' || firmwareUpgradeRequired
    ) {
      return;
    }

    confirmInFlightRef.current = true;
    setIsConfirmInFlight(true);

    try {
      if (!await connect(sellAccount.keystore.rootFingerprint, 'swapPaymentRequests')) {
        return;
      }

      if (!buyAccountCode || !sellAccountCode || !selectedRouteId || !sellAmount || !buyAccount) {
        alertUser(t('genericError'));
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
        alertUser(response.errorCode
          ? t(`send.error.${response.errorCode}`)
          : response.errorMessage || t('genericError'));
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
              variant="navigation"
              hideSidebarToggler
              mobileBackButton
              title={t('generic.swap')}
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
                <DesktopBackButton>
                  {t('button.back')}
                </DesktopBackButton>
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
              variant="navigation"
              hideSidebarToggler
              mobileBackButton
              title={t('generic.swap')}
            />
            <SwapkitTerms />
          </Main>
        </GuidedContent>
      </GuideWrapper>
    );
  }

  const routeError = getQuoteErrorMessage(quoteResult, t);
  const placeholderFiat = (
    !isFetchingRoutes ? (
      <>
        0.00
        <span className={style.unit}>
          {defaultCurrency}
        </span>
      </>
    ) : undefined
  );

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            variant="navigation"
            hideSidebarToggler
            mobileBackButton
            title={t('generic.swap')}
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
                    <AmountWithUnit
                      maxDecimals={9}
                      amount={maxSellAmount.available} />
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
                  placeholder="0"
                  placeholderFiat={placeholderFiat}
                />
              )}
              <Message
                hidden={validationErrorCode !== INSUFFICIENT_FUNDS_ERROR}
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
              <div>
                <Label
                  htmlFor="swapGetAmount">
                  <span>
                    {t('generic.receiveWithoutCoinCode')}
                  </span>
                </Label>
              </div>
              {!buyAccounts || !buyAccountCode ? (
                <Skeleton />
              ) : (
                <InputWithAccountSelector
                  accounts={buyAccounts}
                  id="swapGetAmount"
                  accountCode={buyAccountCode}
                  isAccountDisabled={account => isSameCoinAccount(account, sellAccount)}
                  isAccountSyncing={isBuyAccountSyncing}
                  onChangeAccountCode={setBuyAccountCode}
                  value={!isFetchingRoutes ? expectedOutput : undefined}
                  placeholder={!isFetchingRoutes ? '0' : t('generic.calculating')}
                  placeholderFiat={placeholderFiat}
                  readOnlyAmount
                />
              )}
              <section className={style.swapServiceContainer}>
                {!isFetchingRoutes && routeError ? (
                  <Message type="warning" className={style.routeWarning}>{routeError}</Message>
                ) : (
                  <SwapServiceSelector
                    buyUnit={buyAccount?.coinUnit}
                    isLoading={isFetchingRoutes}
                    onChangeRouteId={setSelectedRouteId}
                    routes={routes ?? []}
                    selectedRouteId={selectedRouteId}
                  />
                )}
              </section>
              {insufficientGasFunds && sellParentAccount && (
                <Message type="info" className={style.gasWarning}>
                  <Trans
                    i18nKey="swap.insufficientGasFunds"
                    values={{ accountName: sellParentAccount.name }}
                    components={{
                      strong: <strong />,
                      buyLink: <Link className={style.buyEthLink} href={`/market/select/${sellParentAccount.code}?tab=buy`} />,
                    }}
                  />
                </Message>
              )}
              {swapStatus === null && (
                <Message type="error" className={style.statusError}>
                  <div>{t('swap.fetchStatusError')}</div>
                  <Button
                    transparent
                    inline
                    onClick={() => setSwapStatusLoadAttempt(attempt => attempt + 1)}>
                    {t('generic.retry')}
                  </Button>
                </Message>
              )}
              {firmwareUpgradeRequired && (
                <Message type="warning" className={style.firmwareWarning}>
                  <div>{t('swap.firmwareUpgradeRequired')}</div>
                  {firmwareDeviceID && (
                    <Link
                      className={style.firmwareUpdateLink}
                      href={`/settings/device-settings/${firmwareDeviceID}`}
                      onClick={() => setFirmwareUpdateDialogOpen(true)}>
                      {t('swap.updateFirmware')}
                    </Link>
                  )}
                </Message>
              )}
            </ViewContent>
            <ViewButtons>
              <Button
                primary
                disabled={!selectedRoute || buyAccountSyncing || isConfirmInFlight || validationErrorCode === INSUFFICIENT_FUNDS_ERROR || insufficientGasFunds || swapStatus?.connectedKeystore !== 'multi' || firmwareUpgradeRequired}
                onClick={handleConfirm}>
                <span className={style.swapButtonContent}>
                  {(isConfirmInFlight || buyAccountSyncing) && (
                    <span className={style.swapButtonSpinner}>
                      <SpinnerRingAnimated />
                    </span>
                  )}
                  {isConfirmInFlight ? t('loading') : buyAccountSyncing ? t('account.syncing') : t('generic.swap')}
                </span>
              </Button>
              <DesktopBackButton>
                {t('button.back')}
              </DesktopBackButton>
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

          {buyAccountCode && sellAccountCode && (
            <SwapResult
              buyAccountCode={buyAccountCode}
              sellAccountCode={sellAccountCode}
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
        <TermsLink provider="Swapkit"><SwapkitTerms readOnly /></TermsLink>
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
