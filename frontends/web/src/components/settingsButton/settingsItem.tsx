import { ReactNode } from 'react';
import style from './settingsButton.module.css';

type TProps = {
  optionalText?: string;
  optionalIcon?: JSX.Element;
  children: ReactNode;
}
export const SettingsItem = ({ optionalText, optionalIcon, children }: TProps) => {
  return (
    <div className={[style.container, style.item].join(' ')}>
      {children}
      {optionalText && <span className={style.optionalText}>{optionalText}</span>}
      {optionalIcon}
    </div>
  );

};
