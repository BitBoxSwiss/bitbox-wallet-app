import { ReactNode } from 'react';
import styles from './settingsItemContainer.module.css';

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
  const notButton = onClick === undefined;
  return (
    <button
      className={`${styles.container} ${notButton ? `${styles.notButton}` : ''}`}
      onClick={onClick}>
      <span>
        <p className={styles.primaryText}>{settingName}</p>
        { secondaryText ? (
          <p className={styles.secondaryText}>{secondaryText}</p>
        ) : null }
      </span>
      {extraComponent ? extraComponent : null}
    </button>
  );
};
