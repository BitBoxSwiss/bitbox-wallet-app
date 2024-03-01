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
import { useContext } from 'react';
import { Fiat, ConversionUnit, IAmount } from '../../api/account';
import { RatesContext } from '../../contexts/RatesContext';
import { Amount } from '../../components/amount/amount';
import style from './rates.module.css';

type FiatWithDisplayName = {
  currency: Fiat,
  displayName: string
}

export const currenciesWithDisplayName: FiatWithDisplayName[] = [
  { currency: 'AUD', displayName: 'Australian Dollar' },
  { currency: 'BRL', displayName: 'Brazilian Real' },
  { currency: 'CAD', displayName: 'Canadian Dollar' },
  { currency: 'CHF', displayName: 'Swiss franc' },
  { currency: 'CNY', displayName: 'Chinese Yuan' },
  { currency: 'CZK', displayName: 'Czech Koruna' },
  { currency: 'EUR', displayName: 'Euro' },
  { currency: 'GBP', displayName: 'British Pound' },
  { currency: 'HKD', displayName: 'Hong Kong Dollar' },
  { currency: 'ILS', displayName: 'Israeli New Shekel' },
  { currency: 'JPY', displayName: 'Japanese Yen' },
  { currency: 'KRW', displayName: 'South Korean Won' },
  { currency: 'NOK', displayName: 'Norwegian Krone' },
  { currency: 'PLN', displayName: 'Polish Zloty' },
  { currency: 'RUB', displayName: 'Russian ruble' },
  { currency: 'SEK', displayName: 'Swedish Krona' },
  { currency: 'SGD', displayName: 'Singapore Dollar' },
  { currency: 'USD', displayName: 'United States Dollar' },
  { currency: 'BTC', displayName: 'Bitcoin' }
];

type TProvidedProps = {
    amount?: IAmount;
    tableRow?: boolean;
    unstyled?: boolean;
    skipUnit?: boolean;
    noAction?: boolean;
    sign?: string;
    noBtcZeroes?: boolean;
    alwaysShowAmounts?: boolean;
}


function Conversion({
  amount,
  tableRow,
  unstyled,
  skipUnit,
  noAction,
  sign,
  noBtcZeroes,
  alwaysShowAmounts = false
}: TProvidedProps) {

  const { rotateFiat, defaultCurrency, btcUnit } = useContext(RatesContext);

  let formattedAmount = <>{'---'}</>;
  let isAvailable = false;

  let activeUnit: ConversionUnit = defaultCurrency;
  // for BTC accounts where the amount unit is sat/tsat we don't want to use sat as activeUnit for redundancy
  if (defaultCurrency === 'BTC' && btcUnit === 'sat' && (amount && amount.unit !== 'tsat' && amount.unit !== 'sat')) {
    activeUnit = 'sat';
  }

  // amount.conversions[defaultCurrency] can be empty in recent transactions.
  if (amount && amount.conversions && amount.conversions[defaultCurrency] && amount.conversions[defaultCurrency] !== '') {
    isAvailable = true;
    formattedAmount = <Amount alwaysShowAmounts={alwaysShowAmounts} amount={amount.conversions[defaultCurrency]} unit={activeUnit} removeBtcTrailingZeroes={!!noBtcZeroes}/>;
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

export const formattedCurrencies = currenciesWithDisplayName.map((fiat) => ({ label: `${fiat.displayName} (${fiat.currency})`, value: fiat.currency }));

export const FiatConversion = Conversion;
