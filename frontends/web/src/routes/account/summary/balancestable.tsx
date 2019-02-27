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
import { Amount, FiatConversion } from '../../../components/rates/rates';
import { translate, TranslateProps } from '../../../decorators/translate';
import { AccountAndBalanceInterface } from './accountssummary';
import { BalanceRow } from './balancerow';

interface ProvidedProps {
    coinCode: string;
    accounts: AccountAndBalanceInterface[];
}

type Props = ProvidedProps & TranslateProps;

class BalancesTable extends Component<Props> {
    public render({ t, coinCode, accounts }: RenderableProps<Props>): JSX.Element {
        let totalAmount: number = 0;
        const rows = accounts.map(account => {
            totalAmount += +account.balance.available.amount; 
            return <BalanceRow name={account.name} balance={account.balance.available}/>;
        });
        const total: Amount = {
            amount: totalAmount.toString(), // Amount type needs to be a
            unit: accounts[0].balance.available.unit,
        };
        return (
            <div>
                <table>
                    <thead>
                        <tr>
                            <th>{coinCode.toUpperCase()}</th>
                        </tr>
                    </thead>
                    <thead>
                        <tr>
                            <th>{t('accountSummary.name')}</th>
                            <th>{t('accountSummary.balance')}</th>
                            <th>{t('accountSummary.fiatBalance')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th>{t('accountSummary.total')}</th>
                            <td>{total!.amount}</td>
                            <td><FiatConversion amount={total!}/></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            );
    }
}

const HOC = translate<ProvidedProps>()(BalancesTable);
export {HOC as BalancesTable}
