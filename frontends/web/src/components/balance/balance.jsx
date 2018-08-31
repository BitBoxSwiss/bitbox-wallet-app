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

import { FiatConversion } from '../../components/rates/rates';
import style from './balance.css';

export default function Balance({
    t,
    code,
    name,
    balance,
}) {
    if (!balance) {
        return (
            <header className={style.balance}></header>
        );
    }
    return (
        <header className={style.balance}>
            <div class={style.accountName}>
                <span>{name}</span>
                <a href={`/account/${code}/info`}>i</a>
            </div>
            <table className={style.balanceTable}>
                <tr>
                    <td className={style.availableAmount}>{balance.available.amount}</td>
                    <td className={style.availableUnit}>{balance.available.unit}</td>
                </tr>
                <FiatConversion amount={balance.available} tableRow />
            </table>
            {
                balance && balance.hasIncoming && (
                    <p class={style.pendingBalance}>
                        {t('account.incoming')} {balance.incoming.amount} {balance.incoming.unit} /
                        <span className={style.incomingConversion}>
                            {' '}
                            <FiatConversion amount={balance.incoming} />
                        </span>
                    </p>
                )
            }
        </header>
    );
}
