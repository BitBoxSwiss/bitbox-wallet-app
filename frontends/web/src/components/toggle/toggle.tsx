import { ChangeEvent } from 'react';
import style from './toggle.module.css';

type ToggleProps = {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value?: string;
};

export const Toggle = (props: ToggleProps) => {
  return (
    <label className={style.container}>
      <input
        type="checkbox"
        {...props} />
      <span className={style.slider}></span>
    </label>
  );
};
