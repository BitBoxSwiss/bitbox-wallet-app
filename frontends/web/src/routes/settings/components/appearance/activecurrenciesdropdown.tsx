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

import { useContext, useEffect, useState } from 'react';
import { ActionMeta } from 'react-select';
import { Fiat } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { SelectedCheckLight } from '@/components/icon';
import { Dropdown } from '@/components/dropdown/dropdown';
import { useTranslation } from 'react-i18next';
import activeCurrenciesDropdownStyle from './activecurrenciesdropdown.module.css';
import settingsDropdownStyles from './settingsdropdown.module.css';

type SelectOption = {
  label: string;
  value: Fiat;
};

type TSelectProps = {
  options: SelectOption[];
  defaultCurrency: Fiat;
  activeCurrencies: Fiat[];
};

export const ActiveCurrenciesDropdown = ({
  options,
  defaultCurrency,
  activeCurrencies,
}: TSelectProps) => {
  const [formattedActiveCurrencies, setFormattedActiveCurrencies] = useState<
    SelectOption[]
  >([]);
  const { t } = useTranslation();

  const { removeFromActiveCurrencies, addToActiveCurrencies } =
    useContext(RatesContext);

  useEffect(() => {
    if (activeCurrencies.length > 0) {
      const formattedSelectedCurrencies = activeCurrencies.map((currency) => ({
        label: currency,
        value: currency,
      }));
      setFormattedActiveCurrencies(formattedSelectedCurrencies);
    }
  }, [activeCurrencies]);

  const Options = ({ props }: { props: SelectOption }) => {
    const { label, value } = props;
    const selected =
      formattedActiveCurrencies.findIndex(
        (currency) => currency.value === value,
      ) >= 0;
    const isDefaultCurrency = defaultCurrency === value;
    return (
      <div
        className={`${activeCurrenciesDropdownStyle.optionContainer} 
        ${isDefaultCurrency ? activeCurrenciesDropdownStyle.defaultCurrency : ''}`}
      >
        <span>{label}</span>
        {isDefaultCurrency ? (
          <p className={activeCurrenciesDropdownStyle.defaultLabel}>
            {t('fiat.default')}
          </p>
        ) : null}
        {selected && !isDefaultCurrency ? <SelectedCheckLight /> : null}
      </div>
    );
  };

  return (
    <Dropdown
      isMulti
      closeMenuOnSelect={false}
      options={options}
      value={formattedActiveCurrencies}
      onChange={async (_, meta: ActionMeta<SelectOption>) => {
        switch (meta.action) {
          case 'select-option':
            if (meta.option) {
              await addToActiveCurrencies(meta.option.value);
            }
            break;
          case 'deselect-option':
            if (meta.option && meta.option.value !== defaultCurrency) {
              await removeFromActiveCurrencies(meta.option.value);
            }
        }
      }}
      isSearchable
      className={settingsDropdownStyles.select}
      renderOptions={(o) => <Options props={o} />}
      classNamePrefix="react-select"
    />
  );
};
