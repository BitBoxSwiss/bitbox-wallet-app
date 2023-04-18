import { ReactNode } from 'react';
import style from './settingsItemContainer.module.css';

interface SettingsButtonProps {
    onClick?: () => void;
    settingName: string;
    secondaryText?: string | JSX.Element;
    extraComponent?: ReactNode;
}

export const SettingsItemContainer = ({
  onClick,
  settingName,
  secondaryText,
  extraComponent
}: SettingsButtonProps) => {
  return (
    <button
      className={style.container}
      onClick={onClick}>
      <span>
        <p className={style.primaryText}>{settingName}</p>
        { secondaryText ? (
          <p className={style.secondaryText}>{secondaryText}</p>
        ) : null }
      </span>
      {extraComponent ? extraComponent : null}
    </button>
  );
};
