// SPDX-License-Identifier: Apache-2.0

import { FunctionComponent } from 'react';
import styles from './checkbox.module.css';

type CheckboxProps = JSX.IntrinsicElements['input'] & {
  label?: string;
  id: string;
  checkboxStyle?: 'default' | 'info' | 'warning' | 'success';
};

export const Checkbox: FunctionComponent<CheckboxProps> = ({
  disabled = false,
  label,
  id,
  className = '',
  children,
  checkboxStyle = 'default',
  ...props
}) => {
  return (
    <span className={`
      ${styles.checkbox || ''}
      ${className}
      ${styles[checkboxStyle] || ''}
    `}>
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
