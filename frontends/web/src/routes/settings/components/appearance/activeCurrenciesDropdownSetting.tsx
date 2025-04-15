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
