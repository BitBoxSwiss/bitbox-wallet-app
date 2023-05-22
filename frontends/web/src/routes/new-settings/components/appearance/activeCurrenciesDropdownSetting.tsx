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

import { useEffect, useState } from 'react';
import Select, { ActionMeta, MultiValue, MultiValueRemoveProps, components } from 'react-select';
import { currencies, store, selectFiat, unselectFiat, SharedProps } from '../../../../components/rates/rates';
import { SettingsItem } from '../settingsItem/settingsItem';
import { Fiat } from '../../../../api/account';
import { share } from '../../../../decorators/share';

type SelectOption = {
  label: Fiat;
  value: Fiat;
}

type TSelectProps = {
  options: SelectOption[];
} & SharedProps;

const ReactSelect = ({ options, active, selected }: TSelectProps) => {
  const [selectedCurrencies, setSelectedCurrencies] = useState<SelectOption[]>([]);

  useEffect(() => {
    if (selected.length > 0) {
      const formattedSelectedCurrencies = selected.map(currency => ({ label: currency, value: currency }));
      setSelectedCurrencies(formattedSelectedCurrencies);
    }
  }, [selected]);

  const MultiValueRemove = (props: MultiValueRemoveProps<SelectOption>) => {
    const currency = props.data.value;
    return (
      currency !== active ?
        <components.MultiValueRemove {...props}>
          {'X'}
        </components.MultiValueRemove>
        : null
    );
  };

  return (
    <Select
      classNamePrefix="react-select"
      isSearchable
      isClearable={false}
      components={{ MultiValueRemove }}
      isMulti
      value={selectedCurrencies}
      onChange={(selectedFiats: MultiValue<SelectOption>, meta: ActionMeta<SelectOption>) => {
        switch (meta.action) {
        case 'remove-value':
          if (selectedFiats.length > 0) {
            const unselectedFiat = meta.removedValue.value;
            unselectFiat(unselectedFiat);
          }
          break;
        case 'select-option':
          const selectedFiat = selectedFiats[selectedFiats.length - 1].value as Fiat;
          selectFiat(selectedFiat);
        }
      }}
      options={options}
    />);
};

const ActiveCurrenciesDropdownSetting = ({ selected, active }: SharedProps) => {
  const formattedCurrencies = currencies.map((currency) => ({ label: currency, value: currency }));
  return (
    <SettingsItem
      settingName="Active Currencies"
      secondaryText="These additional currencies can be toggled through on your account page."
      extraComponent={
        <ReactSelect
          options={formattedCurrencies}
          active={active}
          selected={selected}
        />}
    />
  );
};

export const ActiveCurrenciesDropdownSettingWithStore = share<SharedProps>(store)(ActiveCurrenciesDropdownSetting);