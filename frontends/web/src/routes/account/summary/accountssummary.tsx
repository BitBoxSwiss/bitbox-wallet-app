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
import { AmountInterface, Fiat, FiatConversion } from '../../../components/rates/rates';
import { load } from '../../../decorators/load';
import { TranslateProps } from '../../../decorators/translate';
import Logo from '../../../components/icon/logo';
import { apiPost } from '../../../utils/request';
import { AccountInterface, CoinCode } from '../account';
import { Chart, ChartData } from './chart';
import * as style from './accountssummary.css';

export interface AccountAndBalanceInterface extends AccountInterface {
    balance: BalanceInterface;
}

interface AccountSummaryProps {
    data: Response;
}

interface State {
    exported: string;
}

interface Totals {
    [code: string]: AmountInterface;
}

interface CoinNames {
    [code: string]: string;
}

interface Response {
    accounts: AccountAndBalanceInterface[];
    totals: Totals;
    coinNames: CoinNames;
    chartDataMissing: boolean;
    chartDataDaily: ChartData;
    chartDataHourly: ChartData;
    chartFiat: Fiat;
}

type Props = TranslateProps & AccountSummaryProps;

export type GroupedByCoinCode = {
    [key in CoinCode]?: AccountAndBalanceInterface[];
}

interface BalanceRowProps {
    name: string;
    balance: BalanceInterface;
    coinUnit: string;
    coinCode: CoinCode;
    title: string;
}

class AccountsSummary extends Component<Props, State> {
    public readonly state: State = {
        exported: '',
    };

    private groupByCoinCode(accounts: AccountAndBalanceInterface[]): GroupedByCoinCode {
        return accounts.reduce((acc, current) => {
            const coinCode = current.coinCode;
            if (!acc[coinCode]) {
                acc[coinCode] = [];
            }
            acc[coinCode].push(current);
            return acc;
        }, {});
    }

    private export = () => {
        apiPost('export-account-summary').then(exported => {
            this.setState({ exported });
        });
    }

    private balanceRow = ({ name, balance, coinUnit, children }: RenderableProps<BalanceRowProps>) => {
        const { t } = this.props;
        return (
            <tr key={name}>
                <td data-label={t('accountSummary.name')}>
                    <div class={style.coinName}>
                        {children}
                        {name}
                    </div>
                </td>
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
    };

    public render(
        { t, data }: RenderableProps<Props>, { exported }: State,
    ) {
        const accountsByCoinCodes = this.groupByCoinCode(data.accounts);
        const coins = Object.keys(accountsByCoinCodes);
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('accountSummary.title')}</h2>}>
                        {
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
                        }
                    </Header>
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <Chart
                                dataDaily={data.chartDataMissing ? undefined : data.chartDataDaily}
                                dataHourly={data.chartDataMissing ? undefined : data.chartDataHourly}
                                fiatUnit={data.chartFiat} />
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
                                        { coins.length > 0 ? (
                                            coins.map((coinCode) => (
                                                accountsByCoinCodes[coinCode].map(account => this.balanceRow({
                                                    children: <Logo className={style.coincode} coinCode={coinCode} alt={data.coinNames[coinCode]} active={true} />,
                                                    coinCode,
                                                    title: data.coinNames[coinCode],
                                                    ...account
                                                }))
                                            ))
                                        ) : (
                                            <p>{t('accountSummary.noAccount')}</p>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const HOC = translate()(load<AccountSummaryProps, TranslateProps>({ data: 'account-summary' })(AccountsSummary));
export { HOC as AccountsSummary };
