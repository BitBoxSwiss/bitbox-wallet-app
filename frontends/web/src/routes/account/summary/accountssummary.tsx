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
import { BalanceInterface } from '../../../components/balance/balance';
import { Header } from '../../../components/layout';
import { TranslateProps } from '../../../decorators/translate';
import { AccountInterface } from '../account';
import { BalancesTable } from './balancestable';

interface ProvidedProps {
    accounts: AccountInterface[];
    [property: number]: BalanceInterface;
}

export interface AccountAndBalanceInterface extends AccountInterface {
    balance: BalanceInterface;
}

interface State {
    accounts: AccountAndBalanceInterface;
}

type Props = ProvidedProps & TranslateProps;

class AccountsSummary extends Component<Props, State> {

    private groupByCoin(accounts: AccountAndBalanceInterface[], coinCode: string) {
        return accounts.reduce((accumulator, currentValue) => {
            const key = currentValue[coinCode];
            if (!accumulator[key]) {
                accumulator[key] = [];
            }
            accumulator[key].push(currentValue);
            return accumulator;
        }, {});
    }

    public render({ t, accounts }: RenderableProps<Props>): JSX.Element {
            const pairedBalances: AccountAndBalanceInterface[] = [];
            accounts.forEach((account, index) => {
                pairedBalances.push({...account, balance: this.props[index]});
            });
            const groupedAccounts = this.groupByCoin(pairedBalances, 'coinCode');
            const coins = Object.keys(groupedAccounts);
            return (
            <div>
                <Header title={<h2>{t('accountSummary.title')}</h2>} />
                { coins.length > 0 ?
                    coins.map(coin => <BalancesTable coinCode={coin} accounts={groupedAccounts[coin]}/>)
                    :
                    <p>{t('accountSummary.noAccount')}</p>
                }
            </div>
            );
    }
}

const HOC = translate()(AccountsSummary);
export {HOC as AccountsSummary};
