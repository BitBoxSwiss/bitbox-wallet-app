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

import { Component, h, RenderableProps } from 'preact';
import { translate } from 'react-i18next';
import * as accountApi from '../../../api/account';
import A from '../../../components/anchor/anchor';
import { Header } from '../../../components/layout';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { FiatConversion, formatCurrency } from '../../../components/rates/rates';
import { TranslateProps } from '../../../decorators/translate';
import { Check } from '../../../components/icon/icon';
import Logo from '../../../components/icon/logo';
import Spinner from '../../../components/spinner/ascii';
import { debug } from '../../../utils/env';
import { apiWebsocket } from '../../../utils/websocket';
import { Chart } from './chart';
import * as style from './accountssummary.css';

interface AccountSummaryProps {
    accounts: accountApi.IAccount[];
}

interface Balances {
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
    totalBalancePerCoin?: accountApi.ITotalBalance;
}

type Props = TranslateProps & AccountSummaryProps;

interface BalanceRowProps {
    code: string;
    name: string;
    balance?: accountApi.IBalance;
    coinUnit: string;
    coinCode: accountApi.CoinCode;
}

class AccountsSummary extends Component<Props, State> {
    private summaryReqTimerID?: number;
    public readonly state: State = {
        data: undefined,
        exported: '',
        totalBalancePerCoin: undefined,
    };
    private unsubscribe!: () => void;

    public async componentDidMount() {
        this.unsubscribe = apiWebsocket(this.onEvent);

        const summaryPromise = this.getAccountSummary();
        const promises = this.props.accounts.map(account => this.onStatusChanged(account.code, true));
        const totalBalancePerCoinPromise = this.getAccountsTotalBalance();
        await Promise.all([...promises, totalBalancePerCoinPromise, summaryPromise]);
    }

    public componentWillUnmount() {
        window.clearTimeout(this.summaryReqTimerID);
        this.unsubscribe();
    }

    private getAccountSummary() {
        return accountApi.getSummary().then(data => {
            this.setState({ data }, () => {
                if (this.summaryReqTimerID) {
                    return;
                }
                const delay = (!data || data.chartDataMissing) ? 1000 : 10000;
                this.summaryReqTimerID = window.setTimeout(this.getAccountSummary, delay);
            });
        }).catch(console.error);
    }

    private async getAccountsTotalBalance() {
        try {
            const totalBalancePerCoin = await accountApi.getAccountsTotalBalance();
            this.setState({ totalBalancePerCoin });
        } catch (err) {
            console.error(err)
        }
    }

    private onEvent = (data: any) => {
        for (const account of this.props.accounts) {
            if (data.subject ===  'account/' + account.code + '/synced-addresses-count') {
                this.setState(state => {
                    const syncStatus = {...state.syncStatus};
                    syncStatus[account.code] = data.object;
                    return { syncStatus };
                });
            }
        }
        if (data.type === 'account') {
            switch (data.data) {
                case 'statusChanged':
                case 'syncdone':
                    this.onStatusChanged(data.code);
                    // Force getting account summary now; cancel next scheduled call.
                    window.clearTimeout(this.summaryReqTimerID);
                    this.summaryReqTimerID = undefined;
                    this.getAccountSummary();
                    break;
            }
        }
    }

    private async onStatusChanged(code: string, initial = false) {
        const status = await accountApi.getStatus(code);
        if (status.disabled) {
            return;
        }
        if (!status.synced) {
            return accountApi.init(code);
        }

        const balance = await accountApi.getBalance(code);
        this.setState(state => {
            const balances = {...state.balances};
            balances[code] = balance;
            return { balances };
        });

        if(initial) return;
        return await this.getAccountsTotalBalance();
    }

    private export = () => {
        accountApi.exportSummary().then(exported => {
            this.setState({ exported });
        })
        .catch(console.error);
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
                        <span className={style.summaryTableBalance}>
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
                <td colSpan={2}>
                    { t('account.syncedAddressesCount', {
                        count: syncStatus?.toString(),
                        defaultValue: 0,
                    }) }
                    <Spinner />
                </td>
            </tr>
        );
    }

    private subTotalRow({ code, coinCode, coinUnit, balance}) {
        const { t } = this.props;
        const nameCol = (
            <td data-label={t('accountSummary.name')}>
                <div class={style.coinName}>
                    <Logo className={style.coincode} coinCode={coinCode} active={true} alt={coinCode} />
                </div>
            </td>
        );
        return (
            <tr key={code+name}>
                { nameCol }
                <td data-label={t('accountSummary.balance')}>
                    <span className={style.summaryTableBalance}>
                        {balance}{' '}
                        <span className={style.coinUnit}>{coinUnit}</span>
                    </span>
                </td>
                <td data-label={t('accountSummary.fiatBalance')}>
                    <FiatConversion amount={{ amount: balance, unit: coinUnit }} noAction={true} />
                </td>
            </tr>
        );
    }

    renderAccountSummary() {
        const { accounts } = this.props;
        const { totalBalancePerCoin } = this.state;
        const accountsPerCoin = accounts.reduce((accountPerCoin, account) => {
            accountPerCoin[account.coinCode] ?
                accountPerCoin[account.coinCode].push(account) :
                accountPerCoin[account.coinCode] = [account];
            return accountPerCoin;
        }, {});
        const rows = Object.keys(accountsPerCoin).map(coinCode => {
            if(accountsPerCoin[coinCode]?.length > 1) {
                return [
                    ...accountsPerCoin[coinCode].map(account => this.balanceRow(account)),
                    this.subTotalRow({ ...accounts[0], balance: totalBalancePerCoin?.[coinCode] ?? '' }),
                ];
            }
            return accountsPerCoin[coinCode].map(account => this.balanceRow(account))
        });
        return rows;
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
                                        <Check style="margin-right: 5px !important;" />
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
                        )}
                    </Header>
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            {data ? (
                                <Chart
                                    dataDaily={data.chartDataMissing ? undefined : data.chartDataDaily}
                                    dataHourly={data.chartDataMissing ? undefined : data.chartDataHourly}
                                    fiatUnit={data.chartFiat}
                                    total={data.chartTotal}
                                    isUpToDate={data.chartIsUpToDate} />
                            ) : (
                                <p>&nbsp;</p>
                            )}
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
                                            <p>{t('accountSummary.noAccount')}</p>
                                        )}
                                    </tbody>
                                    {(data && data.chartTotal) ? (
                                        <tfoot>
                                            <tr>
                                                <th>
                                                    <strong>{t('accountSummary.total')}</strong>
                                                </th>
                                                <td colSpan={2}>
                                                    <strong>
                                                        {formatCurrency(data.chartTotal, data.chartFiat)}
                                                    </strong>
                                                    {' '}
                                                    <span className={style.coinUnit}>
                                                        {data.chartFiat}
                                                    </span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    ) : null }
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
