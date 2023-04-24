import { ReactNode } from 'react';
import styles from './settingsItemContainer.module.css';

type TProps = {
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
        <div className={`${styles.container} ${styles.notButton}`} >
          {content}
        </div> :
        <button
          className={styles.container}
          onClick={onClick}>
          {content}
        </button> }
    </>
  );
};
