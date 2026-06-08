// SPDX-License-Identifier: Apache-2.0

import { triggerHapticFeedback } from '@/utils/transport-mobile';
import style from './toggle.module.css';

export type TToggleProps = JSX.IntrinsicElements['input'];

export const Toggle = ({
  className = '',
  onChange,
  ...props
}: TToggleProps) => {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    triggerHapticFeedback();
    onChange?.(e);
  };
  return (
    <label className={`${style.container || ''} ${className}`}>
      <input
        type="checkbox"
        onChange={handleChange}
        {...props} />
      <span className={style.slider}></span>
    </label>
  );
};
