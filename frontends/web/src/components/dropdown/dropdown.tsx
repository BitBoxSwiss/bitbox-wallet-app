/**
 * Copyright 2024 Shift Crypto AG
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

import { ReactNode } from 'react';
import Select, {
  components,
  SingleValueProps,
  OptionProps,
  DropdownIndicatorProps,
  MultiValueProps,
  Props as ReactSelectProps,
  ActionMeta,
} from 'react-select';
import styles from './dropdown.module.css';

export type TOption<T = any> = {
  label: string;
  value: T;
};

type SelectProps<T = any, IsMulti extends boolean = false> = Omit<
  ReactSelectProps<TOption<T>>,
  'onChange'
> & {
  renderOptions: (selectedItem: TOption<T>) => ReactNode; // Function to render options and selected value for single dropdown
  onChange: (
    newValue: IsMulti extends true ? TOption<T>[] : TOption<T>,
    actionMeta: ActionMeta<TOption<T>>,
  ) => void;
};

const DropdownIndicator = (props: DropdownIndicatorProps<TOption>) => (
  <components.DropdownIndicator {...props}>
    <div className={styles.dropdown} />
  </components.DropdownIndicator>
);

const SelectSingleValue = (
  props: SingleValueProps<TOption> & { selectProps: any },
) => {
  const { renderOptions } = props.selectProps;

  return (
    <components.SingleValue {...props}>
      {renderOptions(props.data)}
    </components.SingleValue>
  );
};

const Option = (props: OptionProps<TOption> & { selectProps: any }) => {
  const { renderOptions } = props.selectProps;
  return (
    <components.Option {...props}>
      {renderOptions(props.data)}
    </components.Option>
  );
};

// Displays up to 3 most recently selected items, separated by commas.
// Truncates with '...' if more than 3 are selected.
const CustomMultiValue = ({ index, getValue }: MultiValueProps<TOption>) => {
  // displays only the first MultiValue instance
  if (index > 0) {
    return null;
  }

  const selectedValues = getValue();
  const maxVisible = 3;

  const displayedValues = selectedValues
    .slice()
    .reverse() // shows the latest selected values first
    .slice(0, maxVisible)
    .map((option) => option.value)
    .join(', ');

  const hiddenCount = selectedValues.length - maxVisible;

  return (
    <div className={styles.valueContainer}>
      {hiddenCount > 0 ? `${displayedValues}...` : displayedValues}
    </div>
  );
};

export const Dropdown = <T, IsMulti extends boolean = false>({
  classNamePrefix = 'react-select',
  renderOptions,
  className,
  onChange,
  ...props
}: SelectProps<T, IsMulti>) => {
  return (
    <Select
      className={`
        ${styles.select}
        ${className || ''}
        `}
      classNamePrefix={classNamePrefix}
      isClearable={false}
      hideSelectedOptions={false}
      components={{
        DropdownIndicator,
        SingleValue: (props) =>
          props.isMulti ? undefined : (
            <SelectSingleValue
              {...props}
              selectProps={{ ...props.selectProps, renderOptions }}
            />
          ),
        Option: (props) => (
          <Option
            {...props}
            selectProps={{ ...props.selectProps, renderOptions }}
          />
        ),
        MultiValue: props.isMulti ? CustomMultiValue : undefined, // uses MultiValue only for multi-select
        IndicatorSeparator: () => null,
        MultiValueRemove: () => null,
      }}
      onChange={(selected, actionMeta) => {
        const handleChange = props.isMulti
          ? (onChange as (
              value: TOption<T>[],
              actionMeta: ActionMeta<TOption<T>>,
            ) => void)
          : (onChange as (
              value: TOption<T>,
              actionMeta: ActionMeta<TOption<T>>,
            ) => void);
        handleChange(selected as any, actionMeta);
      }}
      {...props}
    />
  );
};
