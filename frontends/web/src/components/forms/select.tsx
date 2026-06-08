// SPDX-License-Identifier: Apache-2.0

import styles from './select.module.css';

type TOptionTextContent = {
  text: string;
};

export type TOption = JSX.IntrinsicElements['option'] & TOptionTextContent;

type TSelectProps = {
  id: string;
  label?: string;
  options: TOption[];
} & JSX.IntrinsicElements['select'];

export const Select = ({
  id,
  label,
  options = [],
  ...props
}: TSelectProps) => {
  return (
    <div className={styles.select}>
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} {...props}>
        {options.map(({ value, text, disabled = false }) => (
          <option
            key={String(value)}
            value={value}
            disabled={disabled}
          >
            {text}
          </option>
        ))}
      </select>
    </div>
  );
};
