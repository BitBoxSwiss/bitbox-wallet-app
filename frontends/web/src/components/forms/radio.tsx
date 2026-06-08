// SPDX-License-Identifier: Apache-2.0

import style from './radio.module.css';

type IRadioProps = {
  label?: string;
};

type TRadioProps = IRadioProps & JSX.IntrinsicElements['input'];

export const Radio = ({
  disabled = false,
  label,
  id,
  children,
  ...props
}: TRadioProps) => {
  return (
    <span className={style.radio}>
      <input
        type="radio"
        id={id}
        disabled={disabled}
        {...props}
      />
      <label htmlFor={id}>
        {label}
        {children}
      </label>
    </span>
  );
};
