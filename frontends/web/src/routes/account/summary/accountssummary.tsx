/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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

import { Component, PropsWithChildren } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import * as accountApi from '../../../api/account';
import { apiWebsocket, TPayload } from '../../../utils/websocket';
import A from '../../../components/anchor/anchor';
import { Header } from '../../../components/layout';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { FiatConversion } from '../../../components/rates/rates';
import { Check } from '../../../components/icon/icon';
import Logo from '../../../components/icon/logo';
import Spinner from '../../../components/spinner/ascii';
import { Spinner as ErrorSpinner } from '../../../components/spinner/Spinner';
import { debug } from '../../../utils/env';
import { Chart } from './chart';
import { AddBuyReceiveOnEmptyBalances } from '../info/buyReceiveCTA';
import { apiPost } from '../../../utils/request';
import style from './accountssummary.module.css';
import { route } from '../../../utils/route';
import { Skeleton } from '../../../components/skeleton/skeleton';

interface AccountSummaryProps {
    accounts: accountApi.IAccount[];
}

export interface Balances {
    [code: string]: accountApi.IBalance;
}

interface SyncStatus {
    [code: string]: string;
}

interface State {
    data?: accountApi.ISummary;
    exported: string;
    balances?: Balances;
    syncStatus?: SyncStatus;
    offlineErrors: string[];
    totalBalancePerCoin?: accountApi.ITotalBalance;
}

type Props = WithTranslation & AccountSummaryProps;

interface BalanceRowProps {
    code: accountApi.AccountCode;
    name: string;
    balance?: accountApi.IAmount;
    coinUnit: string;
    coinCode: accountApi.CoinCode;
    coinName: string;
}

type TAccountCoinMap = {
    [code in accountApi.CoinCode]: accountApi.IAccount[];
};

class AccountsSummary extends Component<Props, State> {
  private summaryReqTimerID?: number;
  public readonly state: State = {
    data: undefined,
    exported: '',
    offlineErrors: [],
    totalBalancePerCoin: undefined,
  };
  private unsubscribe!: () => void;

  public async componentDidMount() {
    const { accounts } = this.props;
    this.unsubscribe = apiWebsocket(this.onEvent);
    const summaryPromise = this.getAccountSummary();
    const promises = accounts.map(account => this.onStatusChanged(account.code, true));
    const totalBalancePerCoinPromise = this.getAccountsTotalBalance();
    await Promise.all([...promises, totalBalancePerCoinPromise, summaryPromise]);
  }

  public componentWillUnmount() {
    window.clearTimeout(this.summaryReqTimerID);
    this.unsubscribe();
  }

  public componentDidUpdate(prevProps: Props) {
    // accounts can be empty in webdev, this can be removed once this is migrated to FunctionalComponent
    if (this.props.accounts.length === prevProps.accounts.length) {
      return;
    }
    this.props.accounts.map(account => this.onStatusChanged(account.code));
  }

  private getAccountSummary = () => {
    return accountApi.getSummary().then(data => {
      this.setState({ data }, () => {
        if (this.summaryReqTimerID) {
          return;
        }
        const delay = (!data || data.chartDataMissing) ? 1000 : 10000;
        this.summaryReqTimerID = window.setTimeout(this.getAccountSummary, delay);
      });
    }).catch(console.error);
  };

  private async getAccountsTotalBalance() {
    try {
      const totalBalancePerCoin = await accountApi.getAccountsTotalBalance();
      this.setState({ totalBalancePerCoin });
    } catch (err) {
      console.error(err);
    }
  }

  private getAccountsPerCoin = () => {
    return this.props.accounts.reduce((accountPerCoin, account) => {
      accountPerCoin[account.coinCode]
        ? accountPerCoin[account.coinCode].push(account)
        : accountPerCoin[account.coinCode] = [account];
      return accountPerCoin;
    }, {} as TAccountCoinMap);
  };

  private onEvent = (payload: TPayload) => {
    if ('subject' in payload) {
      const { object, subject } = payload;
      for (const account of this.props.accounts) {
        if (subject === 'account/' + account.code + '/synced-addresses-count') {
          this.setState(state => {
            const syncStatus = { ...state.syncStatus };
            syncStatus[account.code] = object;
            return { syncStatus };
          });
        }
      }
    }
    if ('type' in payload) {
      const { code, data, type } = payload;
      if (type === 'account') {
        switch (data) {
        case 'statusChanged':
        case 'syncdone':
          if (code) {
            this.onStatusChanged(code);
          }
          // Force getting account summary now; cancel next scheduled call.
          window.clearTimeout(this.summaryReqTimerID);
          this.summaryReqTimerID = undefined;
          this.getAccountSummary();
          break;
        }
      }
    }
  };

  private async onStatusChanged(code: string, initial: boolean = false) {
    const status = await accountApi.getStatus(code);
    const { offlineErrors } = this.state;
    if (status.offlineError && !offlineErrors.includes(status.offlineError)) {
      this.setState({ offlineErrors: [...offlineErrors, status.offlineError] });
    }
    if (status.disabled) {
      return;
    }
    if (!status.synced) {
      return accountApi.init(code);
    }
    const balance = await accountApi.getBalance(code);
    this.setState(({ balances }) => ({
      balances: {
        ...balances,
        [code]: balance
      }
    }));

    if (initial) {
      return;
    }
    return await this.getAccountsTotalBalance();
  }

  private export = () => {
    accountApi.exportSummary().then(exported => {
      this.setState({ exported });
    })
      .catch(console.error);
  };

  private balanceRow = (
    { code, name, coinCode }: PropsWithChildren<BalanceRowProps>,
  ) => {
    const { t } = this.props;
    const balance = this.state.balances ? this.state.balances[code] : undefined;
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
              {balance.available.amount}{' '}
              <span className={style.coinUnit}>{balance.available.unit}</span>
            </span>
          </td>
          <td data-label={t('accountSummary.fiatBalance')}>
            <FiatConversion amount={balance.available} noAction={true} />
          </td>
        </tr>
      );
    }
    const syncStatus = this.state.syncStatus && this.state.syncStatus[code];
    return (
      <tr key={`${code}_syncing`}>
        { nameCol }
        <td colSpan={2} className={style.syncText}>
          { t('account.syncedAddressesCount', {
            count: syncStatus?.toString(),
            defaultValue: 0,
          } as any) }
          <Spinner />
        </td>
      </tr>
    );
  };

  private subTotalRow({ coinCode, coinName, balance }: PropsWithChildren<BalanceRowProps>) {
    const { t } = this.props;
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
            <strong>{balance.amount}</strong>
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
  }

  private renderAccountSummary() {
    const { totalBalancePerCoin } = this.state;
    const accountsPerCoin = this.getAccountsPerCoin();
    const coins = Object.keys(accountsPerCoin) as accountApi.CoinCode[];
    return coins.map(coinCode => {
      if (accountsPerCoin[coinCode]?.length > 1) {
        return [
          ...accountsPerCoin[coinCode].map(account => this.balanceRow(account)),
          this.subTotalRow({
            ...accountsPerCoin[coinCode][0],
            balance: totalBalancePerCoin && totalBalancePerCoin[coinCode],
          }),
        ];
      }
      return accountsPerCoin[coinCode].map(account => this.balanceRow(account));
    });
  }

  public render() {
    const { t, accounts } = this.props;
    const { exported, data, balances, offlineErrors } = this.state;
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
                  <a key="export" onClick={this.export} title={t('accountSummary.exportSummary')}>
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
              {offlineErrors.length ? (
                <ErrorSpinner text={offlineErrors.join('\n')} guideExists={false} />
              ) : (
                <>
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
                          this.renderAccountSummary()
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
                                  {data.formattedChartTotal}
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
                </>
              )}
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
}

const HOC = withTranslation()(AccountsSummary);
export { HOC as AccountsSummary };
