// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import Select, {
  components,
  SingleValueProps,
  OptionProps,
  DropdownIndicatorProps,
  MultiValueProps,
  GroupProps,
  GroupHeadingProps,
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

export type TGroupedOption<T, TExtra = object, TOptionExt = object> = {
  label: string;
  options: (TOption<T> & TOptionExt)[];
} & TExtra;

export const isGroupedOptions = <T, >(
  options: TOption<T>[] | TGroupedOption<T>[] | undefined
): options is TGroupedOption<T>[] => {
  if (!options || options.length === 0) {
    return false;
  }
  const firstOption = options[0];
  if (!firstOption) {
    return false;
  }
  return 'options' in firstOption && Array.isArray((firstOption as TGroupedOption<T>).options);
};

type SelectProps<T, IsMulti extends boolean = false, TExtra = object, TOptionExt = object> = Omit<
  ReactSelectProps<TOption<T>>,
  'onChange' | 'options'
> & {
  options?: TOption<T>[] | TGroupedOption<T, TExtra, TOptionExt>[];
  renderOptions?: (selectedItem: TOption<T> & TOptionExt, isSelectedValue: boolean) => ReactNode;
  renderGroupHeader?: (group: TGroupedOption<T, TExtra, TOptionExt>) => ReactNode;
  renderTrigger?: ((props: { onClick: () => void }) => ReactNode);
  onChange: (
    newValue: IsMulti extends true ? TOption<T>[] : TOption<T>,
    actionMeta: ActionMeta<TOption<T>>
  ) => void;
  mobileFullScreen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  title?: string;
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

const Group = (props: GroupProps<TOption>) => (
  <div>
    <components.Group {...props} />
  </div>
);

const createGroupHeading = <T, TExtra = object, TOptionExt = object>(
  renderGroupHeader?: (group: TGroupedOption<T, TExtra, TOptionExt>) => ReactNode
) => (props: GroupHeadingProps<TOption<T>>) => {
  if (renderGroupHeader) {
    return (
      <div className={styles.groupHeader}>
        {renderGroupHeader(props.data as unknown as TGroupedOption<T, TExtra, TOptionExt>)}
      </div>
    );
  }
  return <components.GroupHeading {...props} />;
};

export const Dropdown = <T, IsMulti extends boolean = false, TExtra = object, TOptionExt = object>({
  classNamePrefix = 'react-select',
  renderOptions,
  renderGroupHeader,
  renderTrigger,
  className,
  onChange,
  title = '',
  mobileFullScreen = false,
  isOpen,
  onOpenChange,
  options,
  ...props
}: SelectProps<T, IsMulti, TExtra, TOptionExt>) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isGrouped = isGroupedOptions(options);

  if (isMobile && mobileFullScreen) {
    return (
      <MobileFullscreenSelector
        title={title}
        options={options}
        renderOptions={renderOptions || (() => null)}
        renderGroupHeader={renderGroupHeader}
        renderTrigger={renderTrigger}
        value={props.value as IsMulti extends true ? TOption<T>[] : TOption<T>}
        onSelect={onChange}
        isMulti={props.isMulti}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      />
    );
  }

  const componentOverrides: ReactSelectProps<TOption<T>>['components'] = {
    DropdownIndicator,
    SingleValue: (singleValueProps: SingleValueProps<TOption<T>>) =>
      singleValueProps.isMulti ? undefined : (
        <SelectSingleValue
          {...singleValueProps}
          selectProps={{
            ...singleValueProps.selectProps,
            renderOptions,
            renderTrigger,
          }}
        />
      ),
    Option: (optionProps: OptionProps<TOption<T>>) => (
      <Option
        {...optionProps}
        selectProps={{
          ...optionProps.selectProps,
          renderOptions
        }}
      />
    ),
    MultiValue: props.isMulti ? CustomMultiValue : undefined,
    IndicatorSeparator: () => null,
    MultiValueRemove: () => null,
  };

  if (isGrouped) {
    componentOverrides.Group = Group;
    componentOverrides.GroupHeading = createGroupHeading<T, TExtra, TOptionExt>(renderGroupHeader);
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
      options={options}
      components={componentOverrides}
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
