/**
 * Copyright 2025 Shift Crypto AG
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

import { forwardRef } from 'react';
import { TBaseInputProps } from './types';
import { Dropdown, TOption } from '@/components/dropdown/dropdown';
import { ChevronLeftDark } from '@/components/icon';
import baseStyles from './input.module.css';
import styles from './input-with-dropdown.module.css';

export type TInputWithDropdownProps<T> = TBaseInputProps & {
  dropdownOptions?: TOption<T>[];
  dropdownValue?: TOption<T> | null;
  onDropdownChange?: (selected: TOption<T>) => void;
  dropdownPlaceholder?: string;
  dropdownTitle?: string;
  isOptionDisabled?: (option: TOption<T>) => boolean;
  renderOptions?: (option: TOption<T>, isSelectedValue: boolean) => React.ReactNode;
}

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
  return (
    <div className={`
      ${baseStyles.input || ''}
      ${baseStyles[`align-${align}`] || ''}
      ${className}
      ${transparent ? baseStyles.isTransparent || '' : ''}
      `}>
      {label ? (
        <div className="flex flex-row flex-between">
          <label htmlFor={id} className={error ? baseStyles.errorText : ''}>
            {label}
            {error ? (
              <span>:<span>{error.toString()}</span></span>
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
              mobileTriggerComponent={({ onClick }) => (
                <button className={styles.dropdownTrigger} onClick={onClick}>
                  <ChevronLeftDark className={styles.chevron} />
                </button>
              )}
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

