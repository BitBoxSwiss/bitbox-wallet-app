import { FunctionComponent } from 'react';
import style from './settingsButton.module.css';

interface SettingsButtonProps {
    onClick?: () => void;
    danger?: boolean;
    optionalText?: string;
    secondaryText?: string;
    disabled?: boolean;
}

const SettingsButton: FunctionComponent<SettingsButtonProps> = ({
  onClick,
  danger,
  optionalText,
  secondaryText,
  disabled,
  children,
}) => {
  return (
    <button className={[style.container, danger ? style.danger : '', disabled ? style.disabled : ''].join(' ')} onClick={!disabled ? onClick : undefined}>
      <span className={style.children}>
        {children}
        { secondaryText ? (
          <span className={style.secondaryText}>{secondaryText}</span>
        ) : null }
      </span>
      { optionalText ? (
        <span className={style.optionalText}>{optionalText}</span>
      ) : null }
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  );
};

export { SettingsButton };
