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

import { h, Component } from 'preact';
import updating from '../../decorators/updating';
import style from './rates.css';

@updating({ rates: 'coins/rates' })
export default class Rates extends Component {
    render({
        amount,
        children,
        fiat,
        tableRow,
        unstyled,
        rates,
    }, {}) {
        let coin = amount.unit;
        if (coin.length === 4 && coin.startsWith('T')) {
            coin = coin.substring(1);
        }
        if (!rates[coin]) {
            return null;
        }
        const value = rates[coin][fiat.code] * Number(amount.amount);
        if (tableRow) {
            return (
                <tr className={unstyled ? '' : style.fiatRow}>
                    <td className={unstyled ? '' : style.availableFiatAmount}>{formatAsCurrency(value)}</td>
                    <td className={unstyled ? '' : style.availableFiatUnit} onClick={fiat.next}>{fiat.code}</td>
                </tr>
            );
        }
        return (
            <span className={style.rates}>
                {children}
                {formatAsCurrency(value)}
                {' '}
                <span className={style.unit} onClick={fiat.next}>{fiat.code}</span>
            </span>
        );
    }
}

function formatAsCurrency(amount) {
    let formatted = amount.toFixed(2);
    let position = formatted.indexOf('.') - 3;
    while (position > 0) {
        formatted = formatted.slice(0, position) + "'" + formatted.slice(position);
        position = position - 3;
    }
    return formatted;
}
