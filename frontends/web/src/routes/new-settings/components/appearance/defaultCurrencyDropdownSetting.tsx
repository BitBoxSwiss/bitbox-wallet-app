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

import { defaultValueLabel, formattedCurrencies, selectFiat, setActiveFiat, store } from '../../../../components/rates/rates';
import { SingleDropdown } from '../dropdowns/singledropdown';
import { SettingsItem } from '../settingsItem/settingsItem';
import { Fiat } from '../../../../api/account';
import { useTranslation } from 'react-i18next';

export const DefaultCurrencyDropdownSetting = () => {
  const { t } = useTranslation();
  return (
    <SettingsItem
      settingName={t('newSettings.appearance.defaultCurrency.title')}
      secondaryText={t('newSettings.appearance.defaultCurrency.description')}
      collapseOnSmall
      extraComponent={
        <SingleDropdown
          options={formattedCurrencies}
          handleChange={(fiat: Fiat) => {
            setActiveFiat(fiat);
            if (!store.state.selected.includes(fiat)) {
              selectFiat(fiat);
            }
          }}
          defaultValue={{
            label: defaultValueLabel,
            value: store.state.active
          }}
        />
      }
    />
  );
};