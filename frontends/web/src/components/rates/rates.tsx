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

import { PropsWithChildren } from 'react';
import { Coin, Fiat } from '../../api/account';
import { share } from '../../decorators/share';
import { Store } from '../../decorators/store';
import { setConfig } from '../../utils/config';
import { equal } from '../../utils/equal';
import { apiSubscribe } from '../../utils/event';
import { apiGet, apiPost } from '../../utils/request';
import style from './rates.module.css';


export type Rates = {
    [coin in Coin]: {
        [fiat in Fiat]: number;
    }
};

export interface SharedProps {
    rates: Rates | undefined | null;
    active: Fiat;
    selected: Fiat[];
}

export const currencies: Fiat[] = ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'ILS', 'JPY', 'KRW', 'NOK', 'RUB', 'SEK', 'SGD', 'USD', 'BTC'];

export const store = new Store<SharedProps>({
    rates: undefined,
    active: 'USD',
    selected: ['USD', 'EUR', 'CHF'],
});

// TODO: should not invoking apiGet imediatelly, see the apiGet() function for more details
apiGet('config').then((appconf) => {
    if (appconf.frontend && appconf.backend.mainFiat) {
        store.setState({ active: appconf.backend.mainFiat });
    }
    if (appconf.backend && appconf.backend.fiatList) {
        store.setState({ selected: appconf.backend.fiatList });
    }
});

// TODO: should not invoking apiGet imediatelly, see the apiGet() function for more details
apiGet('rates').then(rates => store.setState({ rates }));

apiSubscribe('rates', ({ object }) => store.setState({ rates: object }));

export function setActiveFiat(fiat: Fiat): void {
    if (!store.state.selected.includes(fiat)) {
        selectFiat(fiat);
    }
    store.setState({ active: fiat });
    setConfig({ backend: { mainFiat: fiat } });
}

export function rotateFiat(): void {
    const index = store.state.selected.indexOf(store.state.active);
    const fiat = store.state.selected[(index + 1) % store.state.selected.length];
    setActiveFiat(fiat);
}

export function selectFiat(fiat: Fiat): void {
    const selected = [...store.state.selected, fiat];
    setConfig({ backend: { fiatList: selected } })
    .then(() => {
        store.setState({ selected });
        // Need to reconfigure currency exchange rates updater
        // which is done during accounts reset.
        apiPost('accounts/reinitialize');
    });
}

export function unselectFiat(fiat: Fiat): void {
    const selected = store.state.selected.filter(item => !equal(item, fiat));
    setConfig({ backend: { fiatList: selected } })
    .then(() => {
        store.setState({ selected });
        // Need to reconfigure currency exchange rates updater
        // which is done during accounts reset.
        apiPost('accounts/reinitialize');
    });
}

export function formatNumber(amount: number, maxDigits: number): string {
    let formatted = amount.toFixed(maxDigits);
    let position = formatted.indexOf('.') - 3;
    while (position > 0) {
        formatted = formatted.slice(0, position) + '\'' + formatted.slice(position);
        position = position - 3;
    }
    return formatted;
}

export function formatCurrency(amount: number, fiat: Fiat): string {
    const isBTC = fiat === 'BTC';
    let formatted = formatNumber(amount, isBTC ? 8 : 2);
    if (isBTC) {
        // Replace trailing zeroes except, e.g. "1.10" => "1.1", "1.0" => "1".
        formatted = formatted.replace(/0*$/, '').replace(/\.$/, '');
    }
    return formatted;

}

export interface AmountInterface {
    amount: string;
    unit: Coin;
}

interface ProvidedProps {
    amount: AmountInterface;
    tableRow?: boolean;
    unstyled?: boolean;
    skipUnit?: boolean;
    noAction?: boolean;
}

type Props = ProvidedProps & SharedProps;

function Conversion({
    amount,
    tableRow,
    unstyled,
    skipUnit,
    rates,
    active,
    noAction,
    children,
}: PropsWithChildren<Props>): JSX.Element | null {
    if (!rates) {
        return null;
    }
    const coin = amount.unit;
    let formattedValue = '';
    if (rates[coin]) {
        formattedValue = formatCurrency(rates[coin][active] * Number(amount.amount), active);
    }
    if (tableRow) {
        return (
            <tr className={unstyled ? '' : style.fiatRow}>
                <td className={unstyled ? '' : style.availableFiatAmount}>{formattedValue}</td>
                <td className={unstyled ? '' : style.availableFiatUnit} onClick={rotateFiat}>{active}</td>
            </tr>
        );
    }
    return (
        <span className={style.rates}>
            {children}
            {formattedValue}
            {' '}
            {
                !skipUnit && !noAction && (
                    <span className={style.unitAction} onClick={rotateFiat}>{active}</span>
                )
            }
            {
                !skipUnit && noAction && (
                    <span className={style.unit}>{active}</span>
                )
            }
        </span>
    );
}

export const FiatConversion = share<SharedProps, ProvidedProps>(store)(Conversion);
