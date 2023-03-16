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

import { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import Select, { components, SingleValueProps, OptionProps, SingleValue, DropdownIndicatorProps } from 'react-select';
import { Globe } from '../../../components/icon';
import i18n from '../../../i18n/i18n';
import styles from './countryselect.module.css';

export type TOption = {
    label: string;
    value: string;
}

type TProps = {
    onChangeRegion: (newValue: SingleValue<TOption>) => void,
    regions: TOption[]
    selectedRegion: string;
}

const SelectedRegionIcon = ({ regionCode }: { regionCode: string }) => {
  const squareFlag = ['ch', 'np', 'va'].includes(regionCode) ? 'fis' : '';
  return (
    <span>
      { regionCode === ''
        ? (<Globe className={styles.globe} />)
        : (<span className={`fi fi-${regionCode} ${styles.flag} ${squareFlag}`}></span>)
      }
    </span>
  );
};

const SelectSingleValue: FunctionComponent<SingleValueProps<TOption>> = (props) => {
  const { label, value } = props.data;
  return (
    <div className={styles.singleValueContainer}>
      <SelectedRegionIcon regionCode={value.toLowerCase()} />
      <components.SingleValue {...props}>
        <span className={styles.selectLabelText}>{label}</span>
      </components.SingleValue>
    </div>
  );
};

const SelectOption: FunctionComponent<OptionProps<TOption>> = (props) => {
  const { label, value } = props.data;
  return (
    <components.Option {...props}>
      <div className={styles.optionsContainer}>
        <SelectedRegionIcon regionCode={value.toLowerCase()} />
        <span className={styles.selectLabelText}>{label}</span>
      </div>
    </components.Option>
  );
};

const DropdownIndicator: FunctionComponent<DropdownIndicatorProps<TOption>> = (props) => {
  return (
    <components.DropdownIndicator {...props}>
      <div className={styles.dropdown} />
    </components.DropdownIndicator>
  );
};

const CountrySelect = ({ onChangeRegion, regions, selectedRegion }: TProps) => {
  const { t } = useTranslation();
  const formattedRegionName = new Intl.DisplayNames([i18n.language], { type: 'region' }).of(selectedRegion) || '';
  const selectedRegionName = selectedRegion === '' ? t('buy.exchange.selectRegion') : formattedRegionName;
  return (
    <Select
      className={styles.select}
      classNamePrefix="react-select"
      components={{ DropdownIndicator, SingleValue: SelectSingleValue, Option: SelectOption, IndicatorSeparator: () => null }}
      defaultValue={{ label: selectedRegionName, value: selectedRegion }}
      isSearchable={true}
      onChange={(e) =>
        onChangeRegion(e as SingleValue<TOption>)
      }
      options={[{
        label: t('buy.exchange.selectRegion') || '',
        value: '',
      },
      ...regions]}
    />
  );
};

export { CountrySelect };
