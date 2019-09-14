import { Component, h, RenderableProps } from 'preact';
import * as style from './settingsButton.css';

interface SettingsItemProps {
    optionalText?: string;
}

class SettingsItem extends Component<SettingsItemProps> {
    public render({ optionalText, children }: RenderableProps<SettingsItemProps>) {
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
