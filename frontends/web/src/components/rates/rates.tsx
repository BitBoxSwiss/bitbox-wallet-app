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

import { Fiat, ConversionUnit, IAmount } from '../../api/account';
import { BtcUnit } from '../../api/coins';
import { reinitializeAccounts } from '../../api/backend';
import { share } from '../../decorators/share';
import { Store } from '../../decorators/store';
import { setConfig } from '../../utils/config';
import { Amount } from '../../components/amount/amount';
import { equal } from '../../utils/equal';
import { apiGet } from '../../utils/request';
import style from './rates.module.css';

export interface SharedProps {
    active: Fiat;
    // eslint-disable-next-line react/no-unused-prop-types
    selected: Fiat[];
    btcUnit?: BtcUnit;
}

export const currencies: Fiat[] = ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'ILS', 'JPY', 'KRW', 'NOK', 'RUB', 'SEK', 'SGD', 'USD', 'BTC'];

export const store = new Store<SharedProps>({
  active: 'USD',
  selected: ['USD', 'EUR', 'CHF'],
  btcUnit: 'default',
});

// TODO: should not invoking apiGet imediatelly, see the apiGet() function for more details
updateRatesConfig();

export function updateRatesConfig(): void {
  apiGet('config').then((appconf) => {
    if (appconf.frontend && appconf.backend.mainFiat) {
      store.setState({ active: appconf.backend.mainFiat });
    }
    if (appconf.backend && appconf.backend.fiatList && appconf.backend.btcUnit) {
      store.setState({
        selected: appconf.backend.fiatList,
        btcUnit: appconf.backend.btcUnit,
      });
    }
  });
}

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
      reinitializeAccounts();
    });
}

export function unselectFiat(fiat: Fiat): void {
  const selected = store.state.selected.filter(item => !equal(item, fiat));
  setConfig({ backend: { fiatList: selected } })
    .then(() => {
      store.setState({ selected });
      // Need to reconfigure currency exchange rates updater
      // which is done during accounts reset.
      reinitializeAccounts();
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

type TProvidedProps = {
    amount?: IAmount;
    tableRow?: boolean;
    unstyled?: boolean;
    skipUnit?: boolean;
    noAction?: boolean;
    sign?: string;
    noBtcZeroes?: boolean;
}

type TProps = TProvidedProps & SharedProps;

function Conversion({
  amount,
  tableRow,
  unstyled,
  skipUnit,
  active,
  noAction,
  sign,
  noBtcZeroes,
  btcUnit,
}: TProps) {

  let formattedAmount = <>{'---'}</>;
  let isAvailable = false;

  var activeUnit: ConversionUnit = active;
  if (active === 'BTC' && btcUnit === 'sat') {
    activeUnit = 'sat';
  }

  // amount.conversions[active] can be empty in recent transactions.
  if (amount && amount.conversions && amount.conversions[active] && amount.conversions[active] !== '') {
    isAvailable = true;
    formattedAmount = <Amount amount={amount.conversions[active]} unit={activeUnit} removeBtcTrailingZeroes={!!noBtcZeroes}/>;
  }


  if (tableRow) {
    return (
      <tr className={unstyled ? '' : style.fiatRow}>
        <td className={unstyled ? '' : style.availableFiatAmount}>{formattedAmount}</td>
        {
          !noAction && (
            <td className={unstyled ? '' : style.availableFiatUnit} onClick={rotateFiat}>{activeUnit}</td>
          )
        }
        {
          noAction && (
            <td className={unstyled ? '' : style.availableFiatUnitNoAction}>{activeUnit}</td>
          )
        }
      </tr>
    );
  }
  return (
    <span className={ `${style.rates} ${!isAvailable ? style.notAvailable : ''}`}>
      {isAvailable ? sign : ''}
      {formattedAmount}
      {' '}
      {
        !skipUnit && !noAction && (
          <span className={style.unitAction} onClick={rotateFiat}>{activeUnit}</span>
        )
      }
      {
        !skipUnit && noAction && (
          <span className={style.unit}>{activeUnit}</span>
        )
      }
    </span>
  );
}

export const FiatConversion = share<SharedProps, TProvidedProps>(store)(Conversion);
