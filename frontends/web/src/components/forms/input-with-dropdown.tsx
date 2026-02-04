// SPDX-License-Identifier: Apache-2.0

import { forwardRef } from 'react';
import type { TBaseInputProps } from './types';
import { useMediaQuery } from '@/hooks/mediaquery';
import { Dropdown, TOption } from '@/components/dropdown/dropdown';
import { ChevronDownDark } from '@/components/icon';
import styles from './input-with-dropdown.module.css';

export type TInputWithDropdownProps<T> = TBaseInputProps & {
  dropdownOptions?: TOption<T>[];
  dropdownValue?: TOption<T> | null;
  onDropdownChange?: (selected: TOption<T>) => void;
  dropdownPlaceholder?: string;
  dropdownTitle?: string;
  isOptionDisabled?: (option: TOption<T>) => boolean;
  renderOptions?: (option: TOption<T>, isSelectedValue: boolean) => React.ReactNode;
};

export const InputWithDropdown = forwardRef<HTMLInputElement, TInputWithDropdownProps<any>>(({
  id,
  label = '',
  error,
  align = 'left',
  className = '',
  transparent = false,
  type = 'text',
  labelSection,
  dropdownOptions = [],
  dropdownValue,
  onDropdownChange,
  dropdownPlaceholder = 'Select...',
  dropdownTitle = '',
  isOptionDisabled,
  children,
  renderOptions,
  ...props
}: TInputWithDropdownProps<any>, ref) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return (
    <div className={`
      ${styles.input || ''}
      ${styles[`align-${align}`] || ''}
      ${className}
      ${transparent ? styles.isTransparent || '' : ''}
      `}>
      {label ? (
        <div className={styles.labelContainer}>
          <label htmlFor={id} className={error ? styles.errorText : ''}>
            {label}
            {error ? (
              <span>
                :{' '}
                <span>{error.toString()}</span>
              </span>
            ) : null}
          </label>
          {labelSection && labelSection}
        </div>
      ) : null}
      <div className={styles.inputDropdownWrapper}>
        <input
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          type={type}
          className={styles.inputField}
          id={id}
          ref={ref}
          {...props}
        />
        {children}
        {dropdownOptions.length > 0 && (
          <div>
            <Dropdown
              options={dropdownOptions}
              onChange={(selected) => {
                if (selected && selected.value !== null && onDropdownChange) {
                  onDropdownChange(selected as TOption<any>);
                }
              }}
              value={dropdownValue || { label: dropdownPlaceholder, value: null }}
              className={styles.dropdown}
              classNamePrefix="react-select"
              isClearable={false}
              isOptionDisabled={isOptionDisabled}
              renderTrigger={isMobile ? ({ onClick }) => (
                <button className={styles.dropdownTrigger} onClick={onClick}>
                  <ChevronDownDark />
                </button>
              ) : undefined}
              isSearchable={false}
              title={dropdownTitle}
              mobileFullScreen
              renderOptions={renderOptions}
            />
          </div>
        )}
      </div>
    </div>
  );
});

