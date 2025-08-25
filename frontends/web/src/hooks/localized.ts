/**
 * Copyright 2024 Shift Crypto AG
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

import { FiatWithDisplayName } from '@/api/account';
import { useEffect, useMemo, useState } from 'react';

export const useLocalizedPunctuation = (
  // fallback to 'de-CH' if native locale is an empty string
  locale = 'de-CH'
) => {

  const { decimal, group } = useMemo(() => {
    // defaults
    let decimal = '.';
    let group = '’';
    // try to find decimal and group separators for locale
    try {
      const parts = (
        Intl
          .NumberFormat(locale, { style: 'currency', currency: 'USD' })
          .formatToParts(1234567.89)
      );
      decimal = parts.find(part => part.type === 'decimal')?.value || decimal;
      group = parts.find(part => part.type === 'group')?.value || group;
    } catch {}
    return { decimal, group };
  }, [locale]);

  return { decimal, group };
};


export const useLocalizedFormattedCurrencies = (selectedLang = 'en') => {
  const [currenciesWithDisplayName, setCurrenciesWithDisplayName] = useState<FiatWithDisplayName[]>([
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
    { currency: 'NZD', displayName: 'New Zealand Dollar' },
    { currency: 'PLN', displayName: 'Polish Zloty' },
    { currency: 'RUB', displayName: 'Russian ruble' },
    { currency: 'SEK', displayName: 'Swedish Krona' },
    { currency: 'SGD', displayName: 'Singapore Dollar' },
    { currency: 'USD', displayName: 'United States Dollar' },
    { currency: 'BTC', displayName: 'Bitcoin' },
    { currency: 'sat', displayName: 'Satoshi' }
  ]);

  useEffect(() => {
    const currencyName = new Intl.DisplayNames([selectedLang], { type: 'currency' });

    setCurrenciesWithDisplayName(prev =>
      prev.map(currencyDetail => ({
        ...currencyDetail,
        displayName:
          (currencyDetail.currency === 'BTC' || currencyDetail.currency === 'sat') ?
            currencyDetail.displayName : (currencyName.of(currencyDetail.currency) || currencyDetail.displayName)
      }))
    );

  }, [selectedLang]);

  return { formattedCurrencies: currenciesWithDisplayName.map((fiat) => ({ label: `${fiat.displayName} (${fiat.currency})`, value: fiat.currency })), currenciesWithDisplayName };

};