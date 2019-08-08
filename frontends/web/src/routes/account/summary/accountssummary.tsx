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
import exportIcon from '../../../assets/icons/download.svg';
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
                        <Header title={
                            <h2>{t('accountSummary.title')}
                                {
                                    exported ? (
                                        <A href={exported} title={exported} className="flex flex-row flex-start flex-items-center">
                                            <span style="margin-right: 5px;">
                                                <img src={checkIcon} style="margin-right: 5px !important;" />
                                                <span>{t('account.openFile')}</span>
                                            </span>
                                        </A>
                                    ) : (
                                            <a onClick={this.export} title={t('accountSummary.exportSummary')}>
                                                <img src={exportIcon} />
                                            </a>
                                        )
                                }
                            </h2>
                            } />
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
