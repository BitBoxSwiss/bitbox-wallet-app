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

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../../api/account';
import { unsubscribe, UnsubscribeList } from '../../../utils/subscriptions';
import { apiWebsocket, TPayload } from '../../../utils/websocket';
import { syncAddressesCount } from '../../../api/accountsync';
import { TDevices } from '../../../api/devices';
import { useSDCard } from '../../../hooks/sdcard';
import { Status } from '../../../components/status/status';
import A from '../../../components/anchor/anchor';
import { Header } from '../../../components/layout';
import { Check } from '../../../components/icon/icon';
import { Chart } from './chart';
import { SummaryBalance } from './summarybalance';
import { AddBuyReceiveOnEmptyBalances } from '../info/buyReceiveCTA';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { debug } from '../../../utils/env';
import { apiPost } from '../../../utils/request';

type TProps = {
    accounts: accountApi.IAccount[];
    devices: TDevices;
};

export type Balances = {
    [code: string]: accountApi.IBalance;
};

export type SyncStatus = {
    [code: string]: number;
};

export function AccountsSummary({
  accounts,
  devices,
}: TProps) {
  const { t } = useTranslation();
  const summaryReqTimerID = useRef<number>();
  const unsubscribeList = useRef<UnsubscribeList>([]);
  const firstRender = useRef(true);

  const [summaryData, setSummaryData] = useState<accountApi.ISummary>();
  const [totalBalancePerCoin, setTotalBalancePerCoin] = useState<accountApi.ITotalBalance>();
  const [balances, setBalances] = useState<Balances>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>();
  const [exported, setExported] = useState('');

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

  const onSyncAddressesCount = useCallback((
    code: string,
    syncedAddressesCount: number,
  ) => {
    setSyncStatus((prevSyncStatus) => ({
      ...prevSyncStatus,
      [code]: syncedAddressesCount,
    }));
  }, []);

  const onStatusChanged = useCallback(async (code: string, initial: boolean = false) => {
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
    if (initial) {
      return;
    }
    getAccountsTotalBalance();
  }, []);

  const onEvent = useCallback((payload: TPayload) => {
    if ('type' in payload) {
      const { code, data, type } = payload;
      if (type === 'account') {
        switch (data) {
        case 'statusChanged':
        case 'syncdone':
          if (code) {
            onStatusChanged(code);
          }
          getAccountSummary();
          break;
        }
      }
    }
  }, [onStatusChanged]);

  const subscribe = useCallback(() => {
    unsubscribe(unsubscribeList.current);
    unsubscribeList.current.push(apiWebsocket(onEvent));
    accounts.forEach(account => {
      unsubscribeList.current.push(syncAddressesCount(account.code, onSyncAddressesCount));
      onStatusChanged(account.code, firstRender.current);
    });
  }, [onSyncAddressesCount, onStatusChanged, onEvent, accounts]);

  const exportSummary = async () => {
    try {
      const exportResult = await accountApi.exportSummary();
      setExported(exportResult);
    } catch (err) {
      console.error(err);
    }
  };

  // fetch accounts summary and balance on the first render.
  useEffect(() => {
    if (firstRender.current) {
      getAccountSummary();
      getAccountsTotalBalance();
      return () => {
        firstRender.current = false;
      };
    }
  });

  // update the timer to get a new account summary update when receiving the previous call result.
  useEffect(() => {
    // replace previous timer if present
    if (summaryReqTimerID.current) {
      window.clearTimeout(summaryReqTimerID.current);
    }
    // set new timer
    const delay = (!summaryData || summaryData.chartDataMissing) ? 1000 : 10000;
    summaryReqTimerID.current = window.setTimeout(getAccountSummary, delay);
  }, [summaryData]);

  // update subscriptions on account change.
  useEffect(() => {
    subscribe();
  }, [accounts, subscribe]);

  // clear timer and subcription when unmounting the component.
  useEffect(() => {
    const currentUnsubscribeList = unsubscribeList.current;
    return () => {
      window.clearTimeout(summaryReqTimerID.current);
      unsubscribe(currentUnsubscribeList);
    };
  }, []);

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Status hidden={!hasCard} type="warning">
            {t('warning.sdcard')}
          </Status>
          <Header title={<h2>{t('accountSummary.title')}</h2>}>
            { debug && (
              exported ? (
                <A key="open" href="#" onClick={() => apiPost('open', exported)} title={exported} className="flex flex-row flex-start flex-items-center">
                  <span>
                    <Check style={{ marginRight: '5px !important' }} />
                    <span>{t('account.openFile')}</span>
                  </span>
                </A>
              ) : (
                <a key="export" onClick={exportSummary} title={t('accountSummary.exportSummary')}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#699ec6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </a>
              )
            )}
          </Header>
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
              syncStatus={syncStatus}
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
