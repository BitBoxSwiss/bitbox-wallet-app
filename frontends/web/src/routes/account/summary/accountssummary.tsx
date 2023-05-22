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
import A from '../../../components/anchor/anchor';
import { Header } from '../../../components/layout';
import { Check } from '../../../components/icon/icon';
import { Chart } from './chart';
import { AddBuyReceiveOnEmptyBalances } from '../info/buyReceiveCTA';
import { Amount } from '../../../components/amount/amount';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { debug } from '../../../utils/env';
import { apiPost } from '../../../utils/request';
import Logo from '../../../components/icon/logo';
import Spinner from '../../../components/spinner/ascii';
import { FiatConversion } from '../../../components/rates/rates';
import { route } from '../../../utils/route';
import style from './accountssummary.module.css';

type TProps = {
    accounts: accountApi.IAccount[];
};

export type Balances = {
    [code: string]: accountApi.IBalance;
};

type SyncStatus = {
    [code: string]: number;
};

type BalanceRowProps = {
    code: accountApi.AccountCode;
    name: string;
    balance?: accountApi.IAmount;
    coinUnit: string;
    coinCode: accountApi.CoinCode;
    coinName: string;
};

type TAccountCoinMap = {
    [code in accountApi.CoinCode]: accountApi.IAccount[];
};

export function AccountsSummary({
  accounts,
}: TProps) {
  const { t } = useTranslation();
  const summaryReqTimerID = useRef<number>();
  const unsubscribeList = useRef<UnsubscribeList>([]);
  const firstRender = useRef(true);

  const [data, setData] = useState<accountApi.ISummary>();
  const [totalBalancePerCoin, setTotalBalancePerCoin] = useState<accountApi.ITotalBalance>();
  const [balances, setBalances] = useState<Balances>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>();
  const [exported, setExported] = useState('');

  const getAccountSummary = () => {
    // replace previous timer if present
    if (summaryReqTimerID.current) {
      window.clearTimeout(summaryReqTimerID.current);
    }
    accountApi.getSummary().then(setData).catch(console.error);
  };

  const getAccountsTotalBalance = () => {
    try {
      accountApi.getAccountsTotalBalance().then(setTotalBalancePerCoin);
    } catch (err) {
      console.error(err);
    }
  };

  const getAccountsPerCoin = () => {
    return accounts.reduce((accountPerCoin, account) => {
      accountPerCoin[account.coinCode]
        ? accountPerCoin[account.coinCode].push(account)
        : accountPerCoin[account.coinCode] = [account];
      return accountPerCoin;
    }, {} as TAccountCoinMap);
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

  const exportSummary = () => {
    accountApi.exportSummary().then(setExported).catch(console.error);
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
    const delay = (!data || data.chartDataMissing) ? 1000 : 10000;
    summaryReqTimerID.current = window.setTimeout(getAccountSummary, delay);
  }, [data]);

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

  // TODO move
  const balanceRow = (
    { code, name, coinCode }: BalanceRowProps,
  ) => {
    const balance = balances ? balances[code] : undefined;
    const nameCol = (
      <td
        className={style.clickable}
        data-label={t('accountSummary.name')}
        onClick={() => route(`/account/${code}`)}>
        <div className={style.coinName}>
          <Logo className={style.coincode} coinCode={coinCode} active={true} alt={coinCode} />
          {name}
        </div>
      </td>
    );
    if (balance) {
      return (
        <tr key={`${code}_balance`}>
          { nameCol }
          <td data-label={t('accountSummary.balance')}>
            <span className={style.summaryTableBalance}>
              <Amount amount={balance.available.amount} unit={balance.available.unit}/>{' '}
              <span className={style.coinUnit}>{balance.available.unit}</span>
            </span>
          </td>
          <td data-label={t('accountSummary.fiatBalance')}>
            <FiatConversion amount={balance.available} noAction={true} />
          </td>
        </tr>
      );
    }
    const accountSyncStatus = syncStatus && syncStatus[code];
    return (
      <tr key={`${code}_syncing`}>
        { nameCol }
        <td colSpan={2} className={style.syncText}>
          { t('account.syncedAddressesCount', {
            count: accountSyncStatus?.toString(),
            defaultValue: 0,
          } as any) }
          <Spinner />
        </td>
      </tr>
    );
  };

  // TODO move
  const subTotalRow = ({ coinCode, coinName, balance }: BalanceRowProps) => {
    const nameCol = (
      <td data-label={t('accountSummary.total')}>
        <div className={style.coinName}>
          <Logo className={style.coincode} coinCode={coinCode} active={true} alt={coinCode} />
          <strong className={style.showOnTableView}>
            {t('accountSummary.subtotalWithCoinName', { coinName })}
          </strong>
          <strong className={style.showInCollapsedView}>
            { coinName }
          </strong>
        </div>
      </td>
    );
    if (!balance) {
      return null;
    }
    return (
      <tr key={`${coinCode}_subtotal`} className={style.subTotal}>
        { nameCol }
        <td data-label={t('accountSummary.balance')}>
          <span className={style.summaryTableBalance}>
            <strong>
              <Amount amount={balance.amount} unit={balance.unit}/>
            </strong>
            {' '}
            <span className={style.coinUnit}>{balance.unit}</span>
          </span>
        </td>
        <td data-label={t('accountSummary.fiatBalance')}>
          <strong>
            <FiatConversion amount={balance} noAction={true} />
          </strong>
        </td>
      </tr>
    );
  };

  // TODO move
  const renderAccountSummary = () => {
    const accountsPerCoin = getAccountsPerCoin();
    const coins = Object.keys(accountsPerCoin) as accountApi.CoinCode[];
    return coins.map(coinCode => {
      if (accountsPerCoin[coinCode]?.length > 1) {
        return [
          ...accountsPerCoin[coinCode].map(account => balanceRow(account)),
          subTotalRow({
            ...accountsPerCoin[coinCode][0],
            balance: totalBalancePerCoin && totalBalancePerCoin[coinCode],
          }),
        ];
      }
      return accountsPerCoin[coinCode].map(account => balanceRow(account));
    });
  };

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
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
              data={data}
              noDataPlaceholder={
                (accounts.length === Object.keys(balances || {}).length) ? (
                  <AddBuyReceiveOnEmptyBalances balances={balances} />
                ) : undefined
              } />
            <div className={style.balanceTable}>
              <table className={style.table}>
                <colgroup>
                  <col width="33%" />
                  <col width="33%" />
                  <col width="*" />
                </colgroup>
                <thead>
                  <tr>
                    <th>{t('accountSummary.name')}</th>
                    <th>{t('accountSummary.balance')}</th>
                    <th>{t('accountSummary.fiatBalance')}</th>
                  </tr>
                </thead>
                <tbody>
                  { accounts.length > 0 ? (
                    renderAccountSummary()
                  ) : (
                    <tr>
                      <td colSpan={3} className={style.noAccount}>
                        {t('accountSummary.noAccount')}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th>
                      <strong>{t('accountSummary.total')}</strong>
                    </th>
                    <td colSpan={2}>
                      {(data && data.formattedChartTotal !== null) ? (
                        <>
                          <strong>
                            <Amount amount={data.formattedChartTotal} unit={data.chartFiat}/>
                          </strong>
                          {' '}
                          <span className={style.coinUnit}>
                            {data.chartFiat}
                          </span>
                        </>
                      ) : (<Skeleton />) }
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
