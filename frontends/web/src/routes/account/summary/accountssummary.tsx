// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { TDevices } from '@/api/devices';
import { statusChanged, syncdone } from '@/api/accountsync';
import { unsubscribe } from '@/utils/subscriptions';
import { TUnsubscribe } from '@/utils/transport-common';
import { useMountedRef } from '@/hooks/mount';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { View } from '@/components/view/view';
import { Chart } from './chart';
import { KeystoreBalance } from './keystorebalance';
import { CoinBalance } from './coinbalance';
import { AddBuyReceiveOnEmptyBalances } from '@/routes/account/info/buy-receive-cta';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { AppContext } from '@/contexts/AppContext';
import { getAccountsByKeystore } from '@/routes/account/utils';
import { RatesContext } from '@/contexts/RatesContext';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { BackupReminder } from '@/components/banners/backup';
import { OfflineError } from '@/components/banners/offline-error';

type TProps = {
  accounts: accountApi.TAccount[];
  devices: TDevices;
};

export type Balances = {
  [code: string]: accountApi.TBalance;
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

  const [chartData, setChartData] = useState<accountApi.TChartData>();
  const [accountsBalanceSummary, setAccountsBalanceSummary] = useState<accountApi.TAccountsBalanceSummary>();
  const [balances, setBalances] = useState<Balances>();
  const [offlineError, setOfflineError] = useState<string | null>(null);

  const getChartData = useCallback(async () => {
    // replace previous timer if present
    if (summaryReqTimerID.current) {
      window.clearTimeout(summaryReqTimerID.current);
      summaryReqTimerID.current = undefined;
    }
    let delay = 1000;
    const chartDataResponse = await accountApi.getChartData();
    if (!mounted.current) {
      return;
    }
    if (chartDataResponse.success) {
      setChartData(chartDataResponse.data);
      delay = chartDataResponse.data.chartDataMissing ? 1000 : 10000;
    }
    summaryReqTimerID.current = window.setTimeout(getChartData, delay);
  }, [mounted]);

  const getAccountsBalanceSummary = useCallback(async () => {
    const response = await accountApi.getAccountsBalanceSummary();
    if (!mounted.current) {
      return;
    }
    if (response.success) {
      setAccountsBalanceSummary(response.accountsBalanceSummary);
    }
  }, [mounted]);

  const onStatusChanged = useCallback(async (
    code: accountApi.AccountCode,
  ) => {
    if (!mounted.current) {
      return;
    }
    const status = await accountApi.getStatus(code);
    if (status.disabled || !mounted.current) {
      return;
    }
    setOfflineError(status.offlineError);
    if (!status.synced) {
      return accountApi.init(code);
    }
    const balance = await accountApi.getBalance(code);
    if (!mounted.current) {
      return;
    }
    if (!balance.success) {
      return;
    }
    setBalances((prevBalances) => ({
      ...prevBalances,
      [code]: balance.balance
    }));
  }, [mounted]);

  const update = useCallback((code: accountApi.AccountCode) => {
    if (mounted.current) {
      onStatusChanged(code);
      getChartData();
      getAccountsBalanceSummary();
    }
  }, [getChartData, getAccountsBalanceSummary, mounted, onStatusChanged]);

  useEffect(() => {
    // for subscriptions and unsubscriptions
    // runs only on component mount and unmount.
    const subscriptions: TUnsubscribe[] = [];
    accounts.forEach(account => {
      const currentCode = account.code;
      subscriptions.push(statusChanged(account.code, () => currentCode === account.code && update(account.code)));
      subscriptions.push(syncdone(account.code, () => {
        if (currentCode === account.code) {
          update(account.code);
        }
      }
      ));
    });
    return () => unsubscribe(subscriptions);
  }, [update, accounts]);


  useEffect(() => {
    // handles fetching data and runs on component mount
    // & whenever any of the dependencies change.
    getChartData();
    getAccountsBalanceSummary();
  }, [getChartData, getAccountsBalanceSummary, defaultCurrency]);

  useEffect(() => {
    return () => {
      if (summaryReqTimerID.current) {
        window.clearTimeout(summaryReqTimerID.current);
      }
    };
  }, []);

  useEffect(() => {
    accounts.forEach(account => {
      onStatusChanged(account.code);
    });
    getAccountsBalanceSummary();
  }, [onStatusChanged, getAccountsBalanceSummary, accounts]);

  useEffect(() => {
    getAccountsBalanceSummary();
  }, [defaultCurrency, getAccountsBalanceSummary]);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <OfflineError error={offlineError} />
            <GlobalBanners devices={devices} />
            {accountsByKeystore.map(({ keystore }) => (
              <BackupReminder
                key={keystore.rootFingerprint}
                keystore={keystore}
                accountsBalanceSummary={accountsBalanceSummary}
              />
            ))}
          </ContentWrapper>
          <Header title={<h2>{t('accountSummary.title')}</h2>}>
            <HideAmountsButton />
          </Header>
          <View>
            <Chart
              hideAmounts={hideAmounts}
              data={chartData}
              noDataPlaceholder={
                (accounts.length && accounts.length <= Object.keys(balances || {}).length) ? (
                  <AddBuyReceiveOnEmptyBalances accounts={accounts} balances={balances} />
                ) : undefined
              } />
            {accountsByKeystore.length > 1 && (
              <CoinBalance
                summaryData={chartData}
                coinsBalances={accountsBalanceSummary?.coinsTotalBalance}
              />
            )}
            {accountsByKeystore &&
              (accountsByKeystore.map(({ keystore, accounts }) =>
                (
                  <KeystoreBalance
                    key={keystore.rootFingerprint}
                    accounts={accounts}
                    accountsByKeystore={accountsByKeystore}
                    keystore={keystore}
                    keystoreBalance={accountsBalanceSummary?.keystoresBalance[keystore.rootFingerprint]}
                    balances={balances}
                  />
                )
              ))}
          </View>
        </Main>
      </GuidedContent>
      <Guide title={t('guide.guideTitle.accountSummary')}>
        <Entry key="accountSummaryDescription" entry={{
          text: t('guide.accountSummaryDescription.text'),
          title: t('guide.accountSummaryDescription.title'),
        }} />
        <Entry key="accountSummaryAmount" entry={{
          link: {
            text: 'www.coingecko.com',
            url: 'https://www.coingecko.com/'
          },
          text: t('guide.accountSummaryAmount.text'),
          title: t('guide.accountSummaryAmount.title')
        }} />
        <Entry key="trackingModePortfolioChart" entry={{
          text: t('guide.trackingModePortfolioChart.text'),
          title: t('guide.trackingModePortfolioChart.title'),
        }} />
      </Guide>
    </GuideWrapper>
  );
};
