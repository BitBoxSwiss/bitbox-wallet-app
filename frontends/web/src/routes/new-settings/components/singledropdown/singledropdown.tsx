/**
 * Copyright 2023 Shift Devices AG
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

import { FC } from 'react';
import Select, { components, DropdownIndicatorProps, SingleValue as SingleValueType, SingleValueProps, OptionProps } from 'react-select';
import styles from './singledropdown.module.css';

type TOption = {
    label: string;
    value: string;
}

type TSelectProps = {
    options: TOption[];
    handleChange: (param?: any) => void;
    defaultValue: TOption;
}

const DropdownIndicator: FC<DropdownIndicatorProps<TOption>> = (props) => {
  return (
    <components.DropdownIndicator {...props}>
      <div className={styles.dropdown} />
    </components.DropdownIndicator>
  );
};


const Option: FC<OptionProps<TOption>> = (props) => {
  const { label } = props.data;
  return (
    <components.Option {...props}>
      <div className={styles.valueContainer}>
        <span className={styles.optionValue}>{label}</span>
      </div>
    </components.Option>
  );
};

const SingleValue: FC<SingleValueProps<TOption>> = (props) => {
  const { label } = props.data;
  return (
    <components.SingleValue {...props}>
      <div className={styles.valueContainer}>
        <span className={styles.singleValue}>{label}</span>
      </div>
    </components.SingleValue>
  );
};


export const SingleDropdown = ({ options, handleChange, defaultValue }: TSelectProps) => {
  return (
    <Select
      className={styles.select}
      classNamePrefix="react-select"
      isSearchable={true}
      defaultValue={defaultValue}
      components={{ IndicatorSeparator: () => null, DropdownIndicator, SingleValue, Option }}
      onChange={(selected) => {
        if (selected) {
          const value = (selected as SingleValueType<TOption>)?.value || '';
          handleChange(value);
        }
      }
      }
      options={options}
    />
  );
};