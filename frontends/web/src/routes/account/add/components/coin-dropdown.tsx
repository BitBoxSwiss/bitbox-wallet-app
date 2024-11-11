
/**
 * Copyright 2021-2024 Shift Crypto AG
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
import * as backendAPI from '@/api/backend';
import Select, { components, SingleValueProps, OptionProps, SingleValue, DropdownIndicatorProps } from 'react-select';
import { Logo } from '@/components/icon/logo';
import styles from './coin-dropdown.module.css';

type TCoinDropDownProps = {
  onChange: (coin: backendAPI.ICoin) => void;
  supportedCoins: backendAPI.ICoin[];
  value: string;
};

type TOption = {
  label: string;
  value: backendAPI.ICoin['coinCode'];
  isDisabled: boolean;
};

const DropdownIndicator = (props: DropdownIndicatorProps<TOption>) => {
  return (
    <components.DropdownIndicator {...props}>
      <div className={styles.dropdown} />
    </components.DropdownIndicator>
  );
};

const SelectSingleValue = (props: SingleValueProps<TOption>) => {
  const { value, label } = props.data;
  return (
    <div className={styles.singleValueContainer}>
      <components.SingleValue {...props}>
        <div className={styles.valueContainer}>
          <Logo coinCode={value} alt={label} />
          <span className={styles.selectLabelText}>{label}</span>
        </div>
      </components.SingleValue>
    </div>
  );
};


const SelectOption = (props: OptionProps<TOption>) => {
  const { label, value } = props.data;

  return (
    <components.Option {...props}>
      <div className={styles.valueContainer}>
        <Logo coinCode={value} alt={label} />
        <span className={styles.selectLabelText}>{label}</span>
      </div>
    </components.Option>
  );
};


export const CoinDropDown = ({
  onChange,
  supportedCoins,
  value,
}: TCoinDropDownProps) => {
  const { t } = useTranslation();

  const options: TOption[] = [
    ...supportedCoins.map(({ coinCode, name, canAddAccount }) => ({
      value: coinCode,
      label: name,
      isDisabled: !canAddAccount,
    })),
  ];

  return (
    <Select
      className={styles.select}
      classNamePrefix="react-select"
      autoFocus
      isSearchable={false}
      options={options}
      onChange={(e) => {
        const selectedOption = e as SingleValue<TOption>;
        if (selectedOption) {
          const selectedCoin = supportedCoins.find(c => c.coinCode === selectedOption.value);
          if (selectedCoin) {
            onChange(selectedCoin);
          }
        }
      }}
      value={options.find(option => option.value === value)}
      components={{
        DropdownIndicator,
        SingleValue: SelectSingleValue,
        Option: SelectOption,
        IndicatorSeparator: () => null,
      }}
      placeholder={t('buy.info.selectPlaceholder')}
    />
  );
};
