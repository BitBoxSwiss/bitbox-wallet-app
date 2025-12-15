// SPDX-License-Identifier: Apache-2.0

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
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);
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
      onClick={!isMobileSelectorOpen ? () => setIsMobileSelectorOpen(true) : undefined}
      extraComponent={
        <Dropdown
          className={settingsDropdownStyles.select}
          renderOptions={(o) => (o.label)}
          isMulti={false}
          options={formattedCurrencies}
          title={t('newSettings.appearance.defaultCurrency.title')}
          mobileFullScreen
          isOpen={isMobileSelectorOpen}
          onOpenChange={(isOpen) => setIsMobileSelectorOpen(isOpen)}
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