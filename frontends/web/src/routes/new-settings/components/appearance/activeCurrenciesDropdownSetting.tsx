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

import { store, SharedProps, formattedCurrencies } from '../../../../components/rates/rates';
import { SettingsItem } from '../settingsItem/settingsItem';
import { share } from '../../../../decorators/share';
import { ActiveCurrenciesDropdown } from '../dropdowns/activecurrenciesdropdown';

const ActiveCurrenciesDropdownSetting = ({ selected, active }: SharedProps) => {
  return (
    <SettingsItem
      collapseOnSmall
      settingName="Active Currencies"
      secondaryText="These additional currencies can be toggled through on your account page."
      extraComponent={
        <ActiveCurrenciesDropdown
          options={formattedCurrencies}
          active={active}
          selected={selected}
        />
      }
    />
  );
};

export const ActiveCurrenciesDropdownSettingWithStore = share<SharedProps>(store)(ActiveCurrenciesDropdownSetting);