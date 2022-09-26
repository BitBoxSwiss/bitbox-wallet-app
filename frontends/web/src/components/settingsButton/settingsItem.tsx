import { Component } from 'react';
import style from './settingsButton.module.css';

interface SettingsItemProps {
    optionalText?: string | null;
    optionalIcon?: JSX.Element;
}

class SettingsItem extends Component<SettingsItemProps> {
  public render() {
    const { optionalText, optionalIcon, children } = this.props;
    return (
      <div className={[style.container, style.item].join(' ')}>
        {children}
        {
          optionalText && (
            <span className={style.optionalText}>{optionalText}</span>
          )
        }
        {optionalIcon}
      </div>
    );
  }
}

export { SettingsItem };
