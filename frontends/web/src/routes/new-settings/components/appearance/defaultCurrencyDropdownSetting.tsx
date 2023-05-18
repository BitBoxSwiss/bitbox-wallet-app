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

import { setActiveFiat, store } from '../../../../components/rates/rates';
import { SingleDropdown } from '../singledropdown/singledropdown';
import { SettingsItem } from '../settingsItem/settingsItem';

export const DefaultCurrencyDropdownSetting = () => {
  const formattedCurrencies = store.state.selected.map((currency) => ({ label: currency, value: currency }));

  return (
    <SettingsItem
      settingName="Default Currency"
      secondaryText="Select your default currency."
      extraComponent={
        <SingleDropdown
          options={formattedCurrencies}
          handleChange={setActiveFiat}
          defaultValue={{ label: store.state.active, value: store.state.active }}
        />
      }
    />
  );
};