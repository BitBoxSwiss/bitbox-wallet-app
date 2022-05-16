import { Component } from 'react';
import style from './settingsButton.module.css';

interface SettingsItemProps {
    optionalText?: string | null;
}

class SettingsItem extends Component<SettingsItemProps> {
  public render() {
    const { optionalText, children } = this.props;
    return (
      <div className={[style.container, style.item].join(' ')}>
        {children}
        {
          optionalText && (
            <span className={style.optionalText}>{optionalText}</span>
          )
        }
      </div>
    );
  }
}

export { SettingsItem };
