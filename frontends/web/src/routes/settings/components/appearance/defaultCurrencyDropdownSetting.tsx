/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import { useContext, useState } from 'react';
import { useMediaQuery } from '@/hooks/mediaquery';
import { RatesContext } from '@/contexts/RatesContext';
import { useLocalizedFormattedCurrencies } from '@/hooks/localized';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { Dropdown } from '@/components/dropdown/dropdown';
import settingsDropdownStyles from './settingsdropdown.module.css';

export const DefaultCurrencyDropdownSetting = () => {
  const { t, i18n } = useTranslation();
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const currencyName = new Intl.DisplayNames([i18n.language], { type: 'currency' });
  const { formattedCurrencies, currenciesWithDisplayName } = useLocalizedFormattedCurrencies(i18n.language);
  const { addToActiveCurrencies, updateDefaultCurrency, defaultCurrency, activeCurrencies } = useContext(RatesContext);
  const valueLabel = currenciesWithDisplayName.find(fiat => fiat.currency === defaultCurrency)?.displayName;
  const currencyNameOfDefaultCurrency = currencyName.of(defaultCurrency) || '';
  const defaultValueLabel = valueLabel ? `${currencyNameOfDefaultCurrency} (${defaultCurrency})` : defaultCurrency;
  const isMobile = useMediaQuery('(max-width: 768px)');
  return (
    <SettingsItem
      disabled={!isMobile}
      settingName={t('newSettings.appearance.defaultCurrency.title')}
      secondaryText={t('newSettings.appearance.defaultCurrency.description')}
      collapseOnSmall
      onClick={() => setIsMobileDropdownOpen(true)}
      extraComponent={
        <Dropdown
          className={settingsDropdownStyles.select}
          renderOptions={(o) => (o.label)}
          isMulti={false}
          options={formattedCurrencies}
          title={t('newSettings.appearance.defaultCurrency.title')}
          mobileFullScreen
          isOpen={isMobileDropdownOpen}
          onOpenChange={(isOpen) => setIsMobileDropdownOpen(isOpen)}
          onChange={async (selected) => {
            const fiat = selected.value;
            updateDefaultCurrency(fiat);
            if (!activeCurrencies.includes(fiat)) {
              await addToActiveCurrencies(fiat);
            }
          }}
          value={{
            label: defaultValueLabel,
            value: defaultCurrency
          }}
        />
      }
    />
  );
};