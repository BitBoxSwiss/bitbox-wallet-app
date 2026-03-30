// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getBalance, TBalance, type AccountCode, type TAccount } from '@/api/account';
import { getSwapQuote, type TSwapQuoteRoute } from '@/api/swap';
import { GuideWrapper, GuidedContent, Main, Header } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SubTitle } from '@/components/title';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { Button, Label } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { ArrowSwap } from '@/components/icon';
import { InputWithAccountSelector } from './components/input-with-account-selector';
import { SwapServiceSelector } from './components/swap-service-selector';
import { ConfirmSwap } from './components/swap-confirm';
import { SwapResult } from './components/swap-result';
import { RatesContext } from '@/contexts/RatesContext';
import {
  getConnectedSwapAccounts,
  getDefaultSwapPair,
  getDisabledAccountCodes,
  getFlippedAmounts,
  getPairKey,
  getPreferredBuyAccountCode,
  getPreferredSellAccountCode,
  getSelectedRouteId,
  reconcileSwapPair,
  type TPairAmounts,
} from './services';
import style from './swap.module.css';

type Props = {
  accounts: TAccount[];
  code: AccountCode;
};

type TSwapLocationState = {
  awaitConnectedKeystore?: boolean;
  hadConnectedKeystore?: boolean;
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
  const location = useLocation();
  const navigate = useNavigate();
  const routeSellAccountCode = code || undefined;
  const swapAccounts = useMemo(
    () => getConnectedSwapAccounts(accounts),
    [accounts],
  );
  const locationState = (
    typeof location.state === 'object' && location.state !== null
      ? location.state as TSwapLocationState
      : null
  );
  const awaitConnectedKeystore = Boolean(locationState?.awaitConnectedKeystore);
  const hadConnectedKeystore = Boolean(locationState?.hadConnectedKeystore);

  // TODO: can be removed once real amount's are used for expectedOutput in sendconfirm
  const { btcUnit } = useContext(RatesContext);

  // Send
  const [sellAccountCode, setSellAccountCode] = useState<AccountCode | undefined>(() => (
    getDefaultSwapPair(swapAccounts, routeSellAccountCode).sellAccountCode
  ));
  const [sellAmount, setSellAmount] = useState<string>('');
  const [maxSellAmount, setMaxSellAmount] = useState<TBalance | undefined>();

  // Receive
  const [buyAccountCode, setBuyAccountCode] = useState<AccountCode | undefined>(() => (
    getDefaultSwapPair(swapAccounts, routeSellAccountCode).buyAccountCode
  ));
  const [expectedOutput, setExpectedOutput] = useState<string>('');

  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [routes, setRoutes] = useState<TSwapQuoteRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [isFetchingRoutes, setIsFetchingRoutes] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | undefined>();
  const previousRouteSellAccountCode = useRef(routeSellAccountCode);
  const pairAmountsRef = useRef<Record<string, TPairAmounts>>({});

  const fromAccount = useMemo(
    () => swapAccounts.find(account => account.code === sellAccountCode),
    [swapAccounts, sellAccountCode],
  );
  const toAccount = useMemo(
    () => swapAccounts.find(account => account.code === buyAccountCode),
    [swapAccounts, buyAccountCode],
  );
  const selectedRoute = useMemo(
    () => routes.find(route => route.routeId === selectedRouteId),
    [routes, selectedRouteId],
  );
  const displayedRoute = useMemo(
    () => selectedRoute || routes[0],
    [routes, selectedRoute],
  );
  const sellDisabledAccountCodes = useMemo(
    () => getDisabledAccountCodes(swapAccounts, buyAccountCode),
    [swapAccounts, buyAccountCode],
  );
  const buyDisabledAccountCodes = useMemo(
    () => getDisabledAccountCodes(swapAccounts, sellAccountCode),
    [swapAccounts, sellAccountCode],
  );
  const canFlip = Boolean(buyAccountCode && sellAccountCode);

  useEffect(() => {
    if (swapAccounts.length === 0 || hadConnectedKeystore) {
      return;
    }

    navigate(location.pathname, {
      replace: true,
      state: {
        ...(locationState || {}),
        awaitConnectedKeystore: false,
        hadConnectedKeystore: true,
      },
    });
  }, [hadConnectedKeystore, location.pathname, locationState, navigate, swapAccounts.length]);

  useEffect(() => {
    if (swapAccounts.length > 0 || awaitConnectedKeystore) {
      return;
    }
    navigate('/', { replace: true });
  }, [awaitConnectedKeystore, navigate, swapAccounts.length]);

  useEffect(() => {
    const routeChanged = previousRouteSellAccountCode.current !== routeSellAccountCode;
    previousRouteSellAccountCode.current = routeSellAccountCode;

    const nextPair = routeChanged
      ? getDefaultSwapPair(swapAccounts, routeSellAccountCode)
      : reconcileSwapPair(swapAccounts, { buyAccountCode, sellAccountCode }, routeSellAccountCode);

    if (nextPair.sellAccountCode !== sellAccountCode) {
      setSellAccountCode(nextPair.sellAccountCode);
    }
    if (nextPair.buyAccountCode !== buyAccountCode) {
      setBuyAccountCode(nextPair.buyAccountCode);
    }
  }, [swapAccounts, buyAccountCode, routeSellAccountCode, sellAccountCode]);

  useEffect(() => {
    const pairKey = getPairKey(sellAccountCode, buyAccountCode);
    if (!pairKey) {
      return;
    }
    pairAmountsRef.current[pairKey] = {
      sellAmount,
      expectedOutput,
    };
  }, [buyAccountCode, expectedOutput, sellAccountCode, sellAmount]);

  const clearQuoteState = (error?: string) => {
    setRoutes([]);
    setSelectedRouteId(undefined);
    setExpectedOutput('');
    setRouteError(error);
  };

  // flips sell and buy account
  const handleFlipAccounts = () => {
    if (buyAccountCode && sellAccountCode) {
      const flippedAmounts = getFlippedAmounts(
        pairAmountsRef.current,
        sellAccountCode,
        buyAccountCode,
        sellAmount,
        expectedOutput,
      );
      setSellAccountCode(buyAccountCode);
      setBuyAccountCode(sellAccountCode);
      setSellAmount(flippedAmounts.sellAmount);
      clearQuoteState();
    }
  };

  const handleSellAccountCodeChange = (nextSellAccountCode: AccountCode) => {
    setSellAccountCode(nextSellAccountCode);
    setBuyAccountCode(currentBuyAccountCode => (
      getPreferredBuyAccountCode(swapAccounts, nextSellAccountCode, currentBuyAccountCode)
    ));
  };

  const handleBuyAccountCodeChange = (nextBuyAccountCode: AccountCode) => {
    setBuyAccountCode(nextBuyAccountCode);
    setSellAccountCode(currentSellAccountCode => (
      getPreferredSellAccountCode(swapAccounts, nextBuyAccountCode, currentSellAccountCode)
    ));
  };

  // update max swappable amount (total coins of the account)
  useEffect(() => {
    if (sellAccountCode) {
      fetchBalance(sellAccountCode).then(setMaxSellAmount);
      return;
    }
    setMaxSellAmount(undefined);
  }, [sellAccountCode]);

  useEffect(() => {
    let isCancelled = false;
    const sellCoinCode = fromAccount?.coinCode;
    const buyCoinCode = toAccount?.coinCode;
    const amount = Number(sellAmount);

    if (
      !sellCoinCode
      || !buyCoinCode
      || !sellAmount
      || Number.isNaN(amount)
      || amount <= 0
      || sellCoinCode === buyCoinCode
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
          sellAmount,
          sellCoinCode,
        });
        if (isCancelled) {
          return;
        }
        const nextRoutes = response.success ? response.quote.routes : [];
        if (nextRoutes.length > 0) {
          setRoutes(nextRoutes);
          setSelectedRouteId(currentRouteId => (
            getSelectedRouteId(nextRoutes, currentRouteId)
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
  }, [fromAccount?.coinCode, sellAccountCode, sellAmount, toAccount?.coinCode, buyAccountCode]);

  useEffect(() => {
    setExpectedOutput(displayedRoute?.expectedBuyAmount || '');
  }, [displayedRoute]);

  const handleConfirm = () => {
    // TODO: add api call to confirm a swap on the device
    setIsConfirming(true);
  };

  // TODO: gate ERC20 swaps that need ETH for network fees once the real swap transaction fee
  // source exists. SwapKit route fees are not correct here because BitBoxApp builds the tx itself.
  const isSwapDisabled = !selectedRoute;

  if (swapAccounts.length === 0) {
    if (awaitConnectedKeystore) {
      return null;
    }
    return null;
  }

  return (
    <GuideWrapper>
      <GuidedContent>
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
                accounts={swapAccounts}
                disabledAccountCodes={sellDisabledAccountCodes}
                id="swapSendAmount"
                accountCode={sellAccountCode}
                testId="swap-sell-account"
                onChangeAccountCode={handleSellAccountCodeChange}
                value={sellAmount}
                onChangeValue={setSellAmount}
              />
              <div className={style.flipContainer}>
                <Button
                  disabled={!canFlip}
                  transparent
                  data-testid="swap-flip-button"
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
                <Button transparent className={style.maxButton}>
                  45678 ETH
                </Button>
              </div>
              <InputWithAccountSelector
                accounts={swapAccounts}
                disabledAccountCodes={buyDisabledAccountCodes}
                id="swapGetAmount"
                accountCode={buyAccountCode}
                testId="swap-buy-account"
                onChangeAccountCode={handleBuyAccountCodeChange}
                value={expectedOutput}
              />
              <SwapServiceSelector
                buyUnit={toAccount?.coinUnit}
                error={routeError}
                isLoading={isFetchingRoutes}
                onChangeRouteId={setSelectedRouteId}
                routes={routes}
                selectedRouteId={selectedRouteId}
              />
            </ViewContent>
            <ViewButtons>
              <Button primary disabled={isSwapDisabled} onClick={handleConfirm}>
                {t('generic.swap')}
              </Button>
              <BackButton>
                {t('button.back')}
              </BackButton>
            </ViewButtons>
          </View>

          <ConfirmSwap
            isConfirming={isConfirming}
            expectedOutput={{
              amount: '16.99',
              unit: 'ETH',
              estimated: false, // TODO: consider estimation sign
              conversions: {
                BTC: '0.50000000',
                AUD: '47\'646.46',
                BRL: '176\'043.48',
                CAD: '40\'043.48',
                CHF: '25\'992.00',
                CNY: '232\'759.88',
                CZK: '691\'098.51',
                EUR: '28\'504.84',
                GBP: '24\'879.06',
                HKD: '263\'275.64',
                ILS: '104\'402.61',
                JPY: '5\'201\'349.04',
                KRW: '48\'747\'275.75',
                NOK: '319\'863.34',
                PLN: '512',
                RUB: '512',
                sat: '50000000',
                SEK: '512',
                SGD: '512',
                USD: '33\'642.50',
              }
            }}
            feeAmount={{
              amount: '0.00001211',
              unit: 'ETH',
              estimated: false,
              conversions: {
                BTC: '0.00005000',
                AUD: '4.46',
                BRL: '17.48',
                CAD: '40.48',
                CHF: '25.00',
                CNY: '232.88',
                CZK: '691.51',
                EUR: '28.84',
                GBP: '24.06',
                HKD: '263.64',
                ILS: '104.61',
                JPY: '5\'201.04',
                KRW: '484.75',
                NOK: '319.34',
                PLN: '512',
                RUB: '512',
                sat: '1200',
                SEK: '512',
                SGD: '512',
                USD: '33.50',
              }
            }}
            sellAmount={{
              amount: btcUnit === 'default' ? '0.50000000' : '5000000',
              unit: btcUnit === 'default' ? 'BTC' : 'sat',
              estimated: false,
              conversions: {
                BTC: '0.50000000',
                AUD: '47\'646.46',
                BRL: '176\'043.48',
                CAD: '40\'043.48',
                CHF: '26\'017.00',
                CNY: '232\'759.88',
                CZK: '691\'098.51',
                EUR: '28\'504.84',
                GBP: '24\'879.06',
                HKD: '263\'275.64',
                ILS: '104\'402.61',
                JPY: '5\'201\'349.04',
                KRW: '48\'747\'275.75',
                NOK: '319\'863.34',
                PLN: '512',
                RUB: '512',
                sat: '50000000',
                SEK: '512',
                SGD: '512',
                USD: '33\'642.50',
              }
            }}
          />

          <SwapResult
            buyAccountCode={buyAccountCode}
            onContinue={() => console.log('new swap')}
            result={undefined}
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
