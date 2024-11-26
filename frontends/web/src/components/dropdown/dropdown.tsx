import { ReactNode } from 'react';
import Select, {
  components,
  SingleValueProps,
  OptionProps,
  DropdownIndicatorProps,
  MultiValueProps,
  InputActionMeta,
  ActionMeta,
} from 'react-select';
import styles from './dropdown.module.css';

type TOption<T = any> = {
    label: string;
    value: T;
};

type SelectProps<T = any> = {
    options: TOption<T>[]; // ptions with a generic value type
    defaultValue?: TOption<T> | TOption<T>[] | null; // selected default value(s)
    value?: TOption<T> | TOption<T>[] | null; // selected value(s)
    classNamePrefix?: string; // Prefix for custom class names
    renderOptions: (selectedItem: TOption<T>) => ReactNode; // Function to render options
    onChange: (
    newValue: TOption<T> | TOption<T>[] | null,
    actionMeta: ActionMeta<TOption<T>>
    ) => void; // Callback for on option selected
    onInputChange?: (
        (newValue: string, actionMeta: InputActionMeta) => void)
    | undefined;
    isSearchable?: boolean;
    className?: string;
    closeMenuOnSelect?: boolean;
    placeholder?: string;
    isMulti?: boolean;
};

const DropdownIndicator = (props: DropdownIndicatorProps<TOption>) => (
  <components.DropdownIndicator {...props}>
    <div className={styles.dropdown} />
  </components.DropdownIndicator>
);

const SelectSingleValue = (props: SingleValueProps<TOption> & { selectProps: any }) => {
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
const MultiValue = ({ index, getValue }: MultiValueProps<TOption>) => {
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

export const Dropdown = <T, >({
  options,
  onChange,
  placeholder = 'Select...',
  isSearchable = false,
  isMulti = false,
  className,
  classNamePrefix = 'react-select',
  renderOptions,
  closeMenuOnSelect = true,
  defaultValue,
  value,
  onInputChange,
}: SelectProps<T>) => {
  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      isMulti={isMulti}
      className={`
        ${styles.select}
        ${className || ''}
        `}
      classNamePrefix={classNamePrefix}
      isClearable={false}
      hideSelectedOptions={false}
      components={{
        DropdownIndicator,
        SingleValue: (props) => isMulti ? undefined : <SelectSingleValue {...props} selectProps={{ ...props.selectProps, renderOptions }} />,
        Option: (props) => <Option {...props} selectProps={{ ...props.selectProps, renderOptions }} />,
        MultiValue: isMulti ? MultiValue : undefined, // uses MultiValue only for multi-select
        IndicatorSeparator: () => null,
        MultiValueRemove: () => null,
      }}
      onChange={(selected, actionMeta) => onChange(selected as TOption | TOption[] | null, actionMeta)}
      options={options}
      placeholder={placeholder}
      isSearchable={isSearchable}
      closeMenuOnSelect={closeMenuOnSelect}
      onInputChange={onInputChange}
    />
  );
};

