/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../../api/account';
import { subscribeStatusChange, subscribeSyncdone } from '../../../api/accountsync';
import { TDevices } from '../../../api/devices';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { Status } from '../../../components/status/status';
import { useSubscribeMap } from '../../../hooks/api';
import { useSDCard } from '../../../hooks/sdcard';
import { AddBuyReceiveOnEmptyBalances } from '../info/buyReceiveCTA';
import { Chart } from './chart';
import { SummaryBalance } from './summarybalance';

type TProps = {
    accounts: accountApi.IAccount[];
    devices: TDevices;
};

export type Balances = {
    [code: string]: accountApi.IBalance;
};

export function AccountsSummary({
  accounts,
  devices,
}: TProps) {
  const { t } = useTranslation();
  const summaryReqTimerID = useRef<number>();
  const firstRender = useRef(true);

  const [summaryData, setSummaryData] = useState<accountApi.ISummary>();
  const [totalBalancePerCoin, setTotalBalancePerCoin] = useState<accountApi.ITotalBalance>();
  const [balances, setBalances] = useState<Balances>();

  const hasCard = useSDCard(devices);

  const getAccountSummary = async () => {
    // replace previous timer if present
    if (summaryReqTimerID.current) {
      window.clearTimeout(summaryReqTimerID.current);
    }
    try {
      const summaryData = await accountApi.getSummary();
      setSummaryData(summaryData);
    } catch (err) {
      console.error(err);
    }
  };

  const getAccountsTotalBalance = async () => {
    try {
      const totalBalance = await accountApi.getAccountsTotalBalance();
      setTotalBalancePerCoin(totalBalance);
    } catch (err) {
      console.error(err);
    }
  };

  const onStatusChanged = useCallback(async (code: string, _?: string) => {
    const status = await accountApi.getStatus(code);
    if (status.disabled) {
      return;
    }
    if (!status.synced) {
      return accountApi.init(code);
    }
    const balance = await accountApi.getBalance(code);
    setBalances((prevBalances) => ({
      ...prevBalances,
      [code]: balance
    }));

    if (firstRender.current) {
      return;
    }

    getAccountSummary();
    getAccountsTotalBalance();
  }, []);

  useSubscribeMap<accountApi.AccountCode, string>(
    accounts.map((account) => account.code),
    subscribeStatusChange,
    onStatusChanged,
    [accounts]
  );

  useSubscribeMap<accountApi.AccountCode, string>(
    accounts.map((account) => account.code),
    subscribeSyncdone,
    onStatusChanged,
    [accounts]
  );

  // fetch accounts summary and balance on the first render.
  useEffect(() => {
    getAccountSummary();
    getAccountsTotalBalance();
    return () => {
      firstRender.current = false;
    };
  }, []);

  // call onStatusChanged when accounts changes.
  useEffect(() => {
    accounts.forEach((account) => {
      onStatusChanged(account.code);
    });
  }, [accounts, onStatusChanged]);

  // update the timer to get a new account summary update when receiving the previous call result.
  useEffect(() => {
    // set new timer
    const delay = (!summaryData || summaryData.chartDataMissing) ? 1000 : 10000;
    summaryReqTimerID.current = window.setTimeout(getAccountSummary, delay);
    return () => {
      // replace previous timer if present
      if (summaryReqTimerID.current) {
        window.clearTimeout(summaryReqTimerID.current);
      }
    };
  }, [summaryData]);

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Status hidden={!hasCard} type="warning">
            {t('warning.sdcard')}
          </Status>
          <Header title={<h2>{t('accountSummary.title')}</h2>}/>
          <div className="content padded">
            <Chart
              data={summaryData}
              noDataPlaceholder={
                (accounts.length === Object.keys(balances || {}).length) ? (
                  <AddBuyReceiveOnEmptyBalances balances={balances} />
                ) : undefined
              } />
            <SummaryBalance
              accounts={accounts}
              summaryData={summaryData}
              totalBalancePerCoin={totalBalancePerCoin}
              balances={balances}
            />
          </div>
        </div>
      </div>
      <Guide>
        <Entry key="accountSummaryDescription" entry={t('guide.accountSummaryDescription')} />
        <Entry key="accountSummaryAmount" entry={{
          link: {
            text: 'www.coingecko.com',
            url: 'https://www.coingecko.com/'
          },
          text: t('guide.accountSummaryAmount.text'),
          title: t('guide.accountSummaryAmount.title')
        }} />
        <Entry key="trackingModePortfolioChart" entry={t('guide.trackingModePortfolioChart')} />
      </Guide>
    </div>
  );
}
