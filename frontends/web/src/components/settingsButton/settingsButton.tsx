import { Component, h, RenderableProps } from 'preact';
import * as style from './settingsButton.css';

interface SettingsButtonProps {
    onClick?: () => void | undefined;
    link?: boolean;
    href?: string;
    danger?: boolean;
    optionalText?: string;
    disabled?: boolean;
}

class SettingsButton extends Component<SettingsButtonProps> {
    public render(
        {
            onClick,
            link,
            href,
            danger,
            optionalText,
            disabled,
            children,
        }: RenderableProps<SettingsButtonProps>,
    ) {
        if (link) {
            return (
                <a className={[style.container, danger ? style.danger : '', disabled ? style.disabled : ''].join(' ')} href={href}>
                    {children}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </a>
            );
        } else {
            return (
                <button className={[style.container, danger ? style.danger : '', disabled ? style.disabled : ''].join(' ')} onClick={!disabled ? onClick : undefined}>
                    {children}
                    {
                        optionalText && (
                            <span className={style.optionalText}>{optionalText}</span>
                        )
                    }
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            );
        }
  }
}

export { SettingsButton };
