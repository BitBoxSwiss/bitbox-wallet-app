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