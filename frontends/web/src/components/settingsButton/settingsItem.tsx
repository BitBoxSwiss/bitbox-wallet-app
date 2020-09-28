import { h, RenderableProps } from 'preact';
import * as style from './settingsButton.css';

interface SettingsItemProps {
    optionalText?: string | null;
}

function SettingsItem({
    optionalText,
    children
}: RenderableProps<SettingsItemProps>) {
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

export { SettingsItem };
