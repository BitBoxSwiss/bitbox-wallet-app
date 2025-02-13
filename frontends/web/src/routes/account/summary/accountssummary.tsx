/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023-2024 Shift Crypto AG
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

import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { TDevices } from '@/api/devices';
import { statusChanged, syncdone } from '@/api/accountsync';
import { unsubscribe } from '@/utils/subscriptions';
import { useMountedRef } from '@/hooks/mount';
import { useSDCard } from '@/hooks/sdcard';
import { Status } from '@/components/status/status';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { View } from '@/components/view/view';
import { Chart } from './chart';
import { LightningBalance, SummaryBalance } from './summarybalance';
import { CoinBalance } from './coinbalance';
import { AddBuyReceiveOnEmptyBalances } from '@/routes/account/info/buy-receive-cta';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { AppContext } from '@/contexts/AppContext';
import { getAccountsByKeystore, isAmbiguousName } from '@/routes/account/utils';
import { RatesContext } from '@/contexts/RatesContext';
import { useLightning } from '@/hooks/lightning';
import { getLightningBalance, subscribeNodeState } from '../../../api/lightning';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';

type TProps = {
  accounts: accountApi.IAccount[];
  devices: TDevices;
};

export type Balances = {
  [code: string]: accountApi.IBalance;
};

export const AccountsSummary = ({
  accounts,
  devices,
}: TProps) => {
  const { t } = useTranslation();
  const summaryReqTimerID = useRef<number>();
  const mounted = useMountedRef();
  const { hideAmounts } = useContext(AppContext);
  const { defaultCurrency } = useContext(RatesContext);

  const accountsByKeystore = getAccountsByKeystore(accounts);

  const [summaryData, setSummaryData] = useState<accountApi.TSummary>();
  const [balancePerCoin, setBalancePerCoin] = useState<accountApi.TAccountsBalance>();
  const [accountsTotalBalance, setAccountsTotalBalance] = useState<accountApi.TAccountsTotalBalance>();
  const [coinsTotalBalance, setCoinsTotalBalance] = useState<accountApi.TCoinsTotalBalance>();
  const [balances, setBalances] = useState<Balances>();
  const { lightningConfig } = useLightning();
  const [lightningBalance, setLightningBalance] = useState<accountApi.IBalance>();
  const [lightningKeystoreName, setLightningKeystoreName] = useState('');

  const hasCard = useSDCard(devices);

  const fetchLightningBalance = useCallback(async () => {
    try {
      const balance = await getLightningBalance();
      if (mounted.current) {
        setLightningBalance(balance);
      }
    } catch (err) {
      console.error(err);
    }
  }, [mounted]);

  const fetchLightningKeystoreName = useCallback(async () => {
    if (!lightningConfig.accounts[0]) {
      setLightningKeystoreName('');
      return;
    }
    try {
      const response = await accountApi.getKeystoreName(lightningConfig.accounts[0].rootFingerprint);
      if (mounted.current) {
        setLightningKeystoreName(response.success ? response.keystoreName : '');
      }
    } catch (err) {
      console.error(err);
    }
  }, [lightningConfig.accounts, mounted]);

  const getCoinsTotalBalance = useCallback(async () => {
    try {
      const coinBalance = await accountApi.getCoinsTotalBalance();
      if (!mounted.current) {
        return;
      }
      setCoinsTotalBalance(coinBalance);
    } catch (err) {
      console.error(err);
    }
  }, [mounted]);

  // if there is an active lightning account subscribe to any node state changes.
  useEffect(() => {
    const lightningAccounts = lightningConfig.accounts;
    if (lightningAccounts.length) {
      fetchLightningBalance();
      fetchLightningKeystoreName();
      const subscriptions = [
        subscribeNodeState(async () => {
          await fetchLightningBalance();
          await getCoinsTotalBalance();
        })
      ];
      return () => unsubscribe(subscriptions);
    }
  }, [fetchLightningBalance, getCoinsTotalBalance, fetchLightningKeystoreName, lightningConfig]);

  // lightning account exists but is not from any connected or remembered keystores
  const hasLightningFromOtherKeystore = (
    lightningConfig.accounts.length !== 0
    && (
      !accountsByKeystore.some(({ keystore }) => {
        return keystore.rootFingerprint === lightningConfig.accounts[0].rootFingerprint;
      })
    )
  );
  const allKeystores = (lightningKeystoreName && hasLightningFromOtherKeystore)
    ? [...accountsByKeystore, { keystore: { name: lightningKeystoreName } }]
    : accountsByKeystore;

  const getAccountSummary = useCallback(async () => {
    // replace previous timer if present
    if (summaryReqTimerID.current) {
      window.clearTimeout(summaryReqTimerID.current);
    }
    const summary = await accountApi.getSummary();
    if (!mounted.current) {
      return;
    }
    if (summary.success) {
      setSummaryData(summary.data);
    } else {
      console.error(summary.error);
    }
  }, [mounted]);

  const getAccountsBalance = useCallback(async () => {
    try {
      const balance = await accountApi.getAccountsBalance();
      if (!mounted.current) {
        return;
      }
      setBalancePerCoin(balance);
    } catch (err) {
      console.error(err);
    }
  }, [mounted]);

  const getAccountsTotalBalance = useCallback(async () => {
    const totalBalance = await accountApi.getAccountsTotalBalance();
    if (!mounted.current) {
      return;
    }
    if (totalBalance.success) {
      setAccountsTotalBalance(totalBalance.totalBalance);
    } else {
      // if rates are not available, balance will be reloaded later.
      if (totalBalance.errorCode !== 'ratesNotAvailable') {
        console.error(totalBalance.errorMessage);
      } else {
        console.log('rates not available');
      }
    }
  }, [mounted]);

  const onStatusChanged = useCallback(
    async (code: accountApi.AccountCode) => {
      if (!mounted.current) {
        return;
      }
      const status = await accountApi.getStatus(code);
      if (status.disabled || !mounted.current) {
        return;
      }
      if (!status.synced) {
        return accountApi.init(code);
      }
      const balance = await accountApi.getBalance(code);
      if (!mounted.current) {
        return;
      }
      setBalances((prevBalances) => ({
        ...prevBalances,
        [code]: balance
      }));
    },
    [mounted]
  );

  const update = useCallback(
    (code: accountApi.AccountCode) => {
      if (mounted.current) {
        onStatusChanged(code);
        getAccountSummary();
      }
    },
    [getAccountSummary, mounted, onStatusChanged]
  );

  useEffect(() => {
    // for subscriptions and unsubscriptions
    // runs only on component mount and unmount.
    const subscriptions = [
      statusChanged(update),
      syncdone(update)
    ];
    return () => unsubscribe(subscriptions);
  }, [update]);


  useEffect(() => {
    // handles fetching data and runs on component mount
    // & whenever any of the dependencies change.
    getAccountSummary();
    getAccountsBalance();
    getAccountsTotalBalance();
    getCoinsTotalBalance();
  }, [getAccountSummary, getAccountsBalance, getAccountsTotalBalance, getCoinsTotalBalance, defaultCurrency]);

  // update the timer to get a new account summary update when receiving the previous call result.
  useEffect(() => {
    // set new timer
    const delay = !summaryData || summaryData.chartDataMissing ? 1000 : 10000;
    summaryReqTimerID.current = window.setTimeout(getAccountSummary, delay);
    return () => {
      // replace previous timer if present
      if (summaryReqTimerID.current) {
        window.clearTimeout(summaryReqTimerID.current);
      }
    };
  }, [summaryData, getAccountSummary]);

  useEffect(() => {
    accounts.forEach((account) => {
      onStatusChanged(account.code);
    });
    getAccountsBalance();
    getCoinsTotalBalance();
  }, [onStatusChanged, getAccountsBalance, getCoinsTotalBalance, accounts]);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <GlobalBanners />
            <Status hidden={!hasCard} type="warning">
              {t('warning.sdcard')}
            </Status>
          </ContentWrapper>
          <Header title={<h2>{t('accountSummary.title')}</h2>}>
            <HideAmountsButton />
          </Header>
          <View>
            <Chart
              hideAmounts={hideAmounts}
              data={summaryData}
              noDataPlaceholder={
                accounts.length && accounts.length <= Object.keys(balances || {}).length ? (
                  <AddBuyReceiveOnEmptyBalances accounts={accounts} balances={balances} />
                ) : undefined
              }
              hideChartDetails={hasLightningFromOtherKeystore && allKeystores.length == 1}
            />
            {allKeystores.length > 1 && (
              <CoinBalance
                summaryData={summaryData}
                coinsBalances={coinsTotalBalance}
              />
            )}
            {hasLightningFromOtherKeystore && (
              <LightningBalance
                lightningBalance={lightningBalance}
                lightningAccountKeystoreName={lightningKeystoreName}
                keystoreDisambiguatorName={
                  isAmbiguousName(lightningKeystoreName, allKeystores)
                    ? lightningConfig.accounts[0].rootFingerprint
                    : undefined
                }
              />
            )}
            {accountsByKeystore &&
              (accountsByKeystore.map(({ keystore, accounts }) =>
                (
                  <SummaryBalance
                    key={keystore.rootFingerprint}
                    keystoreDisambiguatorName={
                      isAmbiguousName(keystore.name, allKeystores)
                        ? keystore.rootFingerprint
                        : undefined
                    }
                    accountsKeystore={keystore}
                    accounts={accounts}
                    totalBalancePerCoin={balancePerCoin ? balancePerCoin[keystore.rootFingerprint] : undefined}
                    totalBalance={accountsTotalBalance ? accountsTotalBalance[keystore.rootFingerprint] : undefined}
                    balances={balances}
                    lightningBalance={ (lightningConfig.accounts.length && lightningConfig.accounts[0].rootFingerprint === keystore.rootFingerprint) ? lightningBalance : undefined}
                  />
                )
              ))}
          </View>
        </Main>
      </GuidedContent>
      <Guide title={t('guide.guideTitle.accountSummary')}>
        <Entry key="accountSummaryDescription" entry={t('guide.accountSummaryDescription', { returnObjects: true })} />
        <Entry key="accountSummaryAmount" entry={{
          link: {
            text: 'www.coingecko.com',
            url: 'https://www.coingecko.com/'
          },
          text: t('guide.accountSummaryAmount.text'),
          title: t('guide.accountSummaryAmount.title')
        }} />
        <Entry key="trackingModePortfolioChart" entry={t('guide.trackingModePortfolioChart', { returnObjects: true })} />
      </Guide>
    </GuideWrapper>
  );
};
