// SPDX-License-Identifier: Apache-2.0

import { forwardRef } from 'react';
import { TBaseInputProps } from './types';
import styles from './input.module.css';

export type TInputProps = TBaseInputProps;

export const Input = forwardRef<HTMLInputElement, TInputProps>(({
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
}: TInputProps, ref) => {
  return (
    <div className={[
      styles.input,
      styles[`align-${align}`],
      className,
      transparent ? styles.isTransparent : '',
    ].join(' ')}>
      { label ? (
        <div className={styles.labelContainer}>
          <label htmlFor={id} className={error ? styles.errorText : ''}>
            {label}
            { error ? (
              <span>:<span>{error.toString()}</span></span>
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
