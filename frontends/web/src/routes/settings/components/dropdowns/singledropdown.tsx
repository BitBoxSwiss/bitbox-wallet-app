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

import Select, { components, DropdownIndicatorProps, SingleValueProps, OptionProps } from 'react-select';
import dropdownStyles from './dropdowns.module.css';

type TOption = {
    label: string;
    value: string;
}

type TSelectProps = {
    options: TOption[];
    handleChange: (param?: any) => void;
    value: TOption;
}

const DropdownIndicator = (props: DropdownIndicatorProps<TOption, false>) => {
  return (
    <components.DropdownIndicator {...props}>
      <div className={dropdownStyles.dropdown} />
    </components.DropdownIndicator>
  );
};

const Option = (props: OptionProps<TOption, false>) => {
  const { label } = props.data;
  return (
    <components.Option {...props}>
      <span>{label}</span>
    </components.Option>
  );
};

const SingleValue = (props: SingleValueProps<TOption, false>) => {
  const { label } = props.data;
  return (
    <components.SingleValue {...props}>
      <span>{label}</span>
    </components.SingleValue>
  );
};


export const SingleDropdown = ({ options, handleChange, value }: TSelectProps) => {
  return (
    <Select
      className={dropdownStyles.select}
      classNamePrefix="react-select"
      isSearchable={true}
      value={value}
      components={{ IndicatorSeparator: () => null, DropdownIndicator, SingleValue, Option }}
      onChange={(selected) => {
        if (selected) {
          const value = selected?.value || '';
          handleChange(value);
        }
      }
      }
      options={options}
    />
  );
};