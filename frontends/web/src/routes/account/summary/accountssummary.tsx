/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2020 Shift Crypto AG
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

import { Component, h, RenderableProps } from 'preact';
import { translate } from 'react-i18next';
import checkIcon from '../../../assets/icons/check.svg';
import A from '../../../components/anchor/anchor';
import { BalanceInterface } from '../../../components/balance/balance';
import { Header } from '../../../components/layout';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Fiat, FiatConversion } from '../../../components/rates/rates';
import { TranslateProps } from '../../../decorators/translate';
import Logo from '../../../components/icon/logo';
import { debug } from '../../../utils/env';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { AccountInterface, CoinCode } from '../account';
import { Chart, ChartData } from './chart';
import * as style from './accountssummary.css';

export interface AccountAndBalanceInterface extends AccountInterface {
    balance: BalanceInterface;
}

interface AccountSummaryProps {
    accounts: AccountInterface[];
}

interface State {
    data?: Response;
    exported: string;
    balances?: Balances;
    syncStatus?: SyncStatus;
}

interface SyncStatus {
    [code: string]: string;
}

interface Balances {
    [code: string]: BalanceInterface;
}

interface Response {
    chartDataMissing: boolean;
    chartDataDaily: ChartData;
    chartDataHourly: ChartData;
    chartFiat: Fiat;
    chartTotal: number | null;
    chartIsUpToDate: boolean; // only valid is chartDataMissing is false
}

type Props = TranslateProps & AccountSummaryProps;

export type GroupedByCoinCode = {
    [key in CoinCode]?: AccountAndBalanceInterface[];
}

interface BalanceRowProps {
    code: string;
    name: string;
    balance?: BalanceInterface;
    coinUnit: string;
    coinCode: CoinCode;
}

class AccountsSummary extends Component<Props, State> {
    private summaryReqTimerID?: number;
    public readonly state: State = {
        data: undefined,
        exported: '',
    };
    private unsubscribe!: () => void;

    public componentDidMount() {
        this.getAccountSummary = this.getAccountSummary.bind(this);
        this.getAccountSummary();
        this.unsubscribe = apiWebsocket(this.onEvent);

        this.props.accounts.map((account: AccountInterface) => {
            this.onStatusChanged(account.code);
        });
    }

    public componentWillUnmount() {
        window.clearInterval(this.summaryReqTimerID);
        this.unsubscribe();
    }

    private getAccountSummary() {
        apiGet('account-summary').then(data => {
            this.setState({ data }, () => {
                const delay = (!data || data.chartDataMissing) ? 1000 : 10000;
                this.summaryReqTimerID = window.setTimeout(this.getAccountSummary, delay);
            });
        }).catch(console.error);
    }

    private onEvent = (data: any) => {
        for (const account of this.props.accounts) {
            if (data.subject ===  'account/' + account.code + '/synced-addresses-count') {
                this.setState(state => {
                    const syncStatus = {...state.syncStatus};
                    syncStatus[account.code] = this.props.t('account.syncedAddressesCount', {
                        count: data.object.toString(),
                        defaultValue: 0,
                    });
                    return { syncStatus };
                });
            }
        }
        if (data.type === 'account') {
            switch (data.data) {
                case 'statusChanged':
                    this.onStatusChanged(data.code);
                    break;
            }
        }
    }

    private onStatusChanged(code: string) {
        apiGet(`account/${code}/status`).then(status => {
            const accountSynced = status.includes('accountSynced');
            const accountDisabled = status.includes('accountDisabled');
            if (accountDisabled) {
                return;
            }
            if (!accountSynced) {
                apiPost(`account/${code}/init`);
            } else {
                apiGet(`account/${code}/balance`).then(balance => {
                    this.setState(state => {
                        const balances = {...state.balances};
                        balances[code] = balance;
                        return { balances };
                    });
                });
            }
        });
    }

    private export = () => {
        apiPost('export-account-summary').then(exported => {
            this.setState({ exported });
        });
    }

    private balanceRow = ({ code, name, coinCode, coinUnit }: RenderableProps<BalanceRowProps>) => {
        const { t } = this.props;
        const balance = this.state.balances ? this.state.balances[code] : undefined;
        const nameCol = (
            <td data-label={t('accountSummary.name')}>
                <div class={style.coinName}>
                    <Logo className={style.coincode} coinCode={coinCode} active={true} alt={coinCode} />
                    {name}
                </div>
            </td>
        );
        if (balance) {
            return (
                <tr key={code}>
                    { nameCol }
                    <td data-label={t('accountSummary.balance')}>
                        <span>
                            {balance.available.amount}{' '}
                            <span className={style.coinUnit}>{coinUnit}</span>
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
            <tr key={code}>
                { nameCol }
                <td colSpan={2}>spinning... { syncStatus }</td>
            </tr>
        );
    }

    public render(
        { t, accounts }: RenderableProps<Props>,
        { exported, data }: State,
    ) {
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('accountSummary.title')}</h2>}>
                        { debug && (
                              exported ? (
                                  <A href={exported} title={exported} className="flex flex-row flex-start flex-items-center">
                                      <span>
                                          <img src={checkIcon} style="margin-right: 5px !important;" />
                                          <span>{t('account.openFile')}</span>
                                      </span>
                                  </A>
                              ) : (
                                  <a onClick={this.export} title={t('accountSummary.exportSummary')}>
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#699ec6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                          <polyline points="7 10 12 15 17 10"></polyline>
                                          <line x1="12" y1="15" x2="12" y2="3"></line>
                                      </svg>
                                  </a>
                              )
                        )
                        }
                    </Header>
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            {data && <Chart
                                dataDaily={data.chartDataMissing ? undefined : data.chartDataDaily}
                                dataHourly={data.chartDataMissing ? undefined : data.chartDataHourly}
                                fiatUnit={data.chartFiat}
                                total={data.chartTotal}
                                isUpToDate={data.chartIsUpToDate} />}
                            <div className={style.balanceTable}>
                                <table className={style.table}>
                                    <thead>
                                        <tr>
                                            <th>{t('accountSummary.name')}</th>
                                            <th>{t('accountSummary.balance')}</th>
                                            <th>{t('accountSummary.fiatBalance')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        { accounts.length > 0 ? (
                                            accounts.map(account => this.balanceRow(account))
                                        ) : (
                                            <p>{t('accountSummary.noAccount')}</p>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="accountSummaryDescription" entry={t('guide.accountSummaryDescription')} />
                    <Entry key="accountSummaryAmount" entry={t('guide.accountSummaryAmount')} />
                </Guide>
            </div>
        );
    }
}

const HOC = translate()(AccountsSummary);
export { HOC as AccountsSummary };
