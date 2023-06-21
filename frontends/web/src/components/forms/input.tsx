/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import styles from './input.module.css';

export interface Props {
    align?: 'left' | 'right';
    autoFocus?: boolean;
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
    error?: string | object;
    id?: string;
    label?: string;
    min?: string;
    name?: string;
    onInput?: (e: any) => void;
    onPaste?: (e: any) => void;
    pattern?: string;
    placeholder?: string;
    readOnly?: boolean;
    step?: string;
    title?: string;
    transparent?: boolean;
    type?: 'text' | 'password' | 'number';
    value: string | number;
    maxLength?: number;
    labelSection?: React.ReactNode;
}

export default forwardRef<HTMLInputElement, Props>(function Input({
  id,
  label = '',
  error,
  align = 'left',
  className = '',
  children,
  transparent = false,
  type = 'text',
  labelSection,
  ...props
}, ref) {
  return (
    <div className={[
      styles.input,
      styles[`align-${align}`],
      className,
      transparent ? styles.isTransparent : '',
    ].join(' ')}>
      { label ? (
        <div className="flex flex-row flex-between">
          <label htmlFor={id} className={error ? styles.errorText : ''}>
            {label}
            { error ? (
              <span>:<span>{error}</span></span>
            ) : null }
          </label>
          {labelSection && labelSection}
        </div>
      ) : null }
      <input
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        type={type}
        id={id}
        ref={ref}
        {...props}
      />
      {children}
    </div>
  );
});
