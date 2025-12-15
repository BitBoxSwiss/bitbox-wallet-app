// SPDX-License-Identifier: Apache-2.0

import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@/hooks/mediaquery';
import { RatesContext } from '@/contexts/RatesContext';
import { useLocalizedFormattedCurrencies } from '@/hooks/localized';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { ActiveCurrenciesDropdown } from './activecurrenciesdropdown';

const ActiveCurrenciesDropdownSetting = () => {
  const { t, i18n } = useTranslation();
  const { activeCurrencies, defaultCurrency } = useContext(RatesContext);
  const { formattedCurrencies } = useLocalizedFormattedCurrencies(i18n.language);
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <SettingsItem
      disabled={!isMobile}
      collapseOnSmall
      settingName={t('newSettings.appearance.activeCurrencies.title')}
      secondaryText={t('newSettings.appearance.activeCurrencies.description')}
      onClick={!isMobileSelectorOpen ? () => setIsMobileSelectorOpen(true) : undefined}
      extraComponent={
        <ActiveCurrenciesDropdown
          isOpen={isMobileSelectorOpen}
          onOpenChange={(isOpen) => setIsMobileSelectorOpen(isOpen)}
          options={formattedCurrencies}
          defaultCurrency={defaultCurrency}
          activeCurrencies={activeCurrencies}
        />
      }
    />
  );
};

export { ActiveCurrenciesDropdownSetting };
