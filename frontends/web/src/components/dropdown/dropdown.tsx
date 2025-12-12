// SPDX-License-Identifier: Apache-2.0

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
import { useMediaQuery } from '@/hooks/mediaquery';
import { MobileFullscreenSelector } from './mobile-fullscreen-selector';
import styles from './dropdown.module.css';

export type TOption<T = any> = {
  label: string;
  value: T;
};

type SelectProps<T = any, IsMulti extends boolean = false> = Omit<
  ReactSelectProps<TOption<T>>,
  'onChange'
> & {
  renderOptions?: (selectedItem: TOption<T>, isSelectedValue: boolean) => ReactNode; // Function to render options and selected value for single dropdown
  onChange: (
    newValue: IsMulti extends true ? TOption<T>[] : TOption<T>,
    actionMeta: ActionMeta<TOption<T>>
  ) => void;
  mobileFullScreen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  title?: string;
  mobileTriggerComponent?: ReactNode | ((props: { onClick: () => void }) => ReactNode);
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
      {renderOptions(props.data, true)}
    </components.SingleValue>
  );
};

const Option = (props: OptionProps<TOption> & { selectProps: any }) => {
  const { renderOptions } = props.selectProps;
  return (
    <components.Option {...props}>
      {renderOptions(props.data, false)}
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
    <div>
      {hiddenCount > 0 ? `${displayedValues}...` : displayedValues}
    </div>
  );
};

export const Dropdown = <T, IsMulti extends boolean = false>({
  classNamePrefix = 'react-select',
  renderOptions,
  className,
  onChange,
  title = '',
  mobileFullScreen = false,
  isOpen,
  onOpenChange,
  mobileTriggerComponent,
  ...props
}: SelectProps<T, IsMulti>) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile && mobileFullScreen) {
    const options: TOption<T>[] = props.options
      ? (props.options as TOption<T>[]).filter(
        (option): option is TOption<T> =>
          option !== null &&
            typeof option === 'object' &&
            'value' in option &&
            'label' in option
      )
      : [];

    return (
      <MobileFullscreenSelector
        title={title}
        options={options}
        renderOptions={renderOptions || (() => null)}
        value={props.value as any}
        onSelect={onChange}
        isMulti={props.isMulti}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        triggerComponent={mobileTriggerComponent}
      />
    );
  }

  return (
    <Select
      className={`
        ${styles.select || ''}
        ${className || ''}
      `}
      classNamePrefix={classNamePrefix}
      isClearable={false}
      hideSelectedOptions={false}
      components={{
        DropdownIndicator,
        SingleValue: (props) => props.isMulti ? undefined : <SelectSingleValue {...props} selectProps={{ ...props.selectProps, renderOptions }} />,
        Option: (props) => <Option {...props} selectProps={{ ...props.selectProps, renderOptions }} />,
        MultiValue: props.isMulti ? CustomMultiValue : undefined, // uses MultiValue only for multi-select
        IndicatorSeparator: () => null,
        MultiValueRemove: () => null,
      }}
      onChange={(selected, actionMeta) => {
        const handleChange = props.isMulti
          ? (onChange as (value: TOption<T>[], actionMeta: ActionMeta<TOption<T>>) => void)
          : (onChange as (value: TOption<T>, actionMeta: ActionMeta<TOption<T>>) => void);
        handleChange(selected as any, actionMeta);
      }}
      {...props}
    />
  );
};

