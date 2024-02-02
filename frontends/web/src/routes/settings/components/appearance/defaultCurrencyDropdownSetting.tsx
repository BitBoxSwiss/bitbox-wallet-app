/**
 * Copyright 2023 Shift Crypto AG
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

import { currenciesWithDisplayName, formattedCurrencies } from '../../../../components/rates/rates';
import { SingleDropdown } from '../dropdowns/singledropdown';
import { SettingsItem } from '../settingsItem/settingsItem';
import { Fiat } from '../../../../api/account';
import { useTranslation } from 'react-i18next';
import { useContext } from 'react';
import { RatesContext } from '../../../../contexts/RatesContext';

export const DefaultCurrencyDropdownSetting = () => {
  const { t } = useTranslation();
  const { selectFiat, updateDefaultFiat, defaultCurrency, activeCurrencies } = useContext(RatesContext);
  const valueLabel = currenciesWithDisplayName.find(fiat => fiat.currency === defaultCurrency)?.displayName;
  const defaultValueLabel = valueLabel ? `${valueLabel} (${defaultCurrency})` : defaultCurrency;
  return (
    <SettingsItem
      settingName={t('newSettings.appearance.defaultCurrency.title')}
      secondaryText={t('newSettings.appearance.defaultCurrency.description')}
      collapseOnSmall
      extraComponent={
        <SingleDropdown
          options={formattedCurrencies}
          handleChange={async (fiat: Fiat) => {
            updateDefaultFiat(fiat);
            if (!activeCurrencies.includes(fiat)) {
              await selectFiat(fiat);
            }
          }}
          defaultValue={{
            label: defaultValueLabel,
            value: defaultCurrency
          }}
        />
      }
    />
  );
};