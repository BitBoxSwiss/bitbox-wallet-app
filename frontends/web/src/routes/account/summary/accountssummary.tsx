/**
 * Copyright 2018 Shift Devices AG
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
import { Amount } from '../../../components/rates/rates';
import { load } from '../../../decorators/load';
import { TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { AccountInterface } from '../account';
import { BalancesTable } from './balancestable';

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
    [code: string]: Amount;
}

interface Response {
    accounts: AccountAndBalanceInterface[];
    totals: Totals;
}

type Props = TranslateProps & AccountSummaryProps;

class AccountsSummary extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = ({ exported: '' });
    }

    private groupByCoin(accounts: AccountAndBalanceInterface[]) {
        return accounts.reduce((accumulator: {[coinCode: string]: AccountAndBalanceInterface[]}, currentValue) => {
            const key: string = currentValue.coinCode;
            if (!accumulator[key]) {
                accumulator[key] = [];
            }
            accumulator[key].push(currentValue);
            return accumulator;
        }, {});
    }

    private export = () => {
        apiPost(`export-account-summary`).then(exported => {
            this.setState({ exported });
        });
    }

    public render(
        { t, data }: RenderableProps<Props>, { exported }: State,
    ) {
            const groupedAccounts = this.groupByCoin(data.accounts);
            const coins = Object.keys(groupedAccounts);
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
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#699ec6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                                {
                                    coins.length > 0 ?
                                    coins.map((coin, index) => <BalancesTable coinCode={coin} accounts={groupedAccounts[coin]} total={data.totals[coin]} index={index} />) :
                                    <p>{t('accountSummary.noAccount')}</p>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            );
    }
}

const HOC = translate()(load<AccountSummaryProps, TranslateProps>({ data: 'account-summary' })(AccountsSummary));
export { HOC as AccountsSummary };
