import { ReactNode } from 'react';
import styles from './settingsItem.module.css';

type TProps = {
    className?: string
    onClick?: () => void;
    settingName: string;
    secondaryText?: string | JSX.Element;
    extraComponent?: ReactNode;
}

export const SettingsItem = ({
  className,
  onClick,
  settingName,
  secondaryText,
  extraComponent,
}: TProps) => {
  const notButton = onClick === undefined;

  const content =
    (<>
      <span>
        <p className={styles.primaryText}>{settingName}</p>
        { secondaryText ? (
          <p className={styles.secondaryText}>{secondaryText}</p>
        ) : null }
      </span>
      {extraComponent ? extraComponent : null }
    </>
    );

  // render as div when it's notButton
  // otherwise, render as button
  return (
    <>
      {notButton ?
        <div className={`${styles.container} ${styles.notButton} ${className}`} >
          {content}
        </div> :
        <button
          className={`${styles.container} ${className}`}
          onClick={onClick}>
          {content}
        </button> }
    </>
  );
};
