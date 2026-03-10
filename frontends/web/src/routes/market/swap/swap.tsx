// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBalance, getSwapDestinationAccounts, TBalance, type AccountCode, type ERC20CoinCode, type TAccount } from '@/api/account';
import * as backendAPI from '@/api/backend';
import { GuideWrapper, GuidedContent, Main, Header } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SubTitle } from '@/components/title';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { alertUser } from '@/components/alert/Alert';
import { Button, Label } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { ArrowSwap } from '@/components/icon';
import { findAccount } from '@/routes/account/utils';
import { useLoad } from '@/hooks/api';
import { InputWithAccountSelector } from './components/input-with-account-selector';
import { SwapServiceSelector } from './components/swap-service-selector';
import { ConfirmSwap } from './components/swap-confirm';
import { SwapResult } from './components/swap-result';
import { RatesContext } from '@/contexts/RatesContext';
import style from './swap.module.css';

type Props = {
  activeAccounts: TAccount[];
  accounts: TAccount[];
  code: AccountCode;
};

const fetchBlance = async (code: AccountCode) => {
  const response = await getBalance(code);
  if (response.success) {
    return response.balance;
  }
  return;
};

export const Swap = ({
  activeAccounts,
  accounts,
  code,
}: Props) => {
  const { t } = useTranslation();
  const buyAccounts = useLoad(getSwapDestinationAccounts, [accounts]) || [];

  // TODO: can be removed once real amount's are used for expectedOutput in sendconfirm
  const { btcUnit } = useContext(RatesContext);

  // Send
  const [sellAccountCode, setSellAccountCode] = useState<string>(code);
  const [sellAmount, setSellAmount] = useState<string>('');
  const [maxSellAmount, setMaxSellAmount] = useState<TBalance | undefined>();

  // Receive
  const [buyAccountCode, setBuyAccountCode] = useState<string>();
  const [expectedOutput, setExpectedOutput] = useState<string>('');

  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  const [canFlip, setCanFlip] = useState<boolean>(false);

  const buyAccount = buyAccountCode
    ? findAccount(buyAccounts, buyAccountCode)
    : undefined;

  // enable flip button
  useEffect(() => {
    setCanFlip(
      buyAccount?.active === true
      && sellAccountCode !== undefined
    );
  }, [buyAccount, sellAccountCode]);

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
      fetchBlance(sellAccountCode).then(setMaxSellAmount);
    }
  }, [sellAccountCode]);

  const handleConfirm = async () => {
    if (buyAccount && !buyAccount.active) {
      // TODO: move activation as late as possible in the real swap flow, or ask for explicit confirmation first.
      if (buyAccount.isToken) {
        const parentEthAccountCode = buyAccount.parentAccountCode;
        if (!parentEthAccountCode) {
          alertUser(t('genericError'));
          return;
        }
        const tokenActivation = await backendAPI.setTokenActive(
          parentEthAccountCode,
          buyAccount.coinCode as ERC20CoinCode,
          true,
        );
        if (!tokenActivation.success) {
          alertUser(tokenActivation.errorMessage || t('genericError'));
          return;
        }
      } else {
        const { success, errorMessage } = await backendAPI.setAccountActive(buyAccount.code, true);
        if (!success) {
          alertUser(errorMessage || t('genericError'));
          return;
        }
      }
    }
    // TODO: add api call to confirm a swap on the device
    setIsConfirming(true);
  };

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
                accounts={activeAccounts}
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
                <Button transparent className={style.maxButton}>
                  45678 ETH
                </Button>
              </div>
              <InputWithAccountSelector
                accounts={buyAccounts}
                id="swapGetAmount"
                accountCode={buyAccountCode}
                onChangeAccountCode={setBuyAccountCode}
                value={expectedOutput}
              />
              <SwapServiceSelector />
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={handleConfirm}>
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
