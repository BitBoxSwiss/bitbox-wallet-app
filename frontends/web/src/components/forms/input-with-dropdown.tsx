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

import { ChangeEvent, HTMLProps, forwardRef } from 'react';
import { Dropdown, TOption } from '@/components/dropdown/dropdown';
import { Logo } from '@/components/icon/logo';
import * as accountApi from '@/api/account';
import { ChevronLeftDark } from '@/components/icon';
import styles from './input-with-dropdown.module.css';

const AccountOption = ({ option }: { option: TOption<accountApi.IAccount | null> }) => {
  if (!option.value) {
    return <span>{option.label}</span>;
  }

  return (
    <div className={styles.accountOption}>
      <Logo coinCode={option.value.coinCode} alt={option.value.coinName} className={styles.coinLogo} />
      <span className={styles.accountName}>{option.value.name}</span>
    </div>
  );
};



export type TInputWithDropdownProps<T> = {
  align?: 'left' | 'right';
  className?: string;
  error?: string | object;
  onInput?: (e: ChangeEvent<HTMLInputElement>) => void;
  transparent?: boolean;
  labelSection?: JSX.Element | undefined;
  label?: string;
  dropdownOptions?: TOption<T>[];
  dropdownValue?: TOption<T> | null;
  onDropdownChange?: (selected: TOption<T>) => void;
  dropdownPlaceholder?: string;
  dropdownTitle?: string;
  showDropdown?: boolean;
  children?: React.ReactNode;
} & Omit<HTMLProps<HTMLInputElement>, 'onInput'>

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
  showDropdown = false,
  children,
  ...props
}: TInputWithDropdownProps<any>, ref) => {
  return (
    <div className={[
      styles.input,
      styles[`align-${align}`],
      className,
      transparent ? styles.isTransparent : '',
    ].join(' ')}>
      {label ? (
        <div className="flex flex-row flex-between">
          <label htmlFor={id} className={error ? styles.errorText : ''}>
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
        {showDropdown && dropdownOptions.length > 0 && (
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
              mobileTriggerComponent={({ onClick }) => (
                <button className={styles.dropdownTrigger} onClick={onClick}>
                  <ChevronLeftDark className={styles.chevron} />
                </button>
              )}
              isSearchable={false}
              title={dropdownTitle}
              mobileFullScreen
              renderOptions={(e) => <AccountOption option={e} />}
            />
          </div>
        )}
      </div>
    </div>
  );
});

