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

import { FunctionComponent } from 'react';
import styles from './checkbox.module.css';

type CheckboxProps = JSX.IntrinsicElements['input'] & {
  label?: string;
  id: string;
  checkboxStyle?: 'default' | 'info' | 'warning' | 'success';
}

const Checkbox: FunctionComponent<CheckboxProps> = ({
  disabled = false,
  label,
  id,
  className = '',
  children,
  checkboxStyle = 'default',
  ...props
}) => {
  return (
    <span className={`${styles.checkbox} ${className} ${styles[checkboxStyle] || ''}`}>
      <input
        type="checkbox"
        id={id}
        disabled={disabled}
        {...props}
      />
      <label htmlFor={id}>{label} {children}</label>
    </span>
  );
};

export default Checkbox;
