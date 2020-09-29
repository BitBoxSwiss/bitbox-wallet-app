import { Component, h, RenderableProps } from 'preact';
import * as style from './settingsButton.css';

interface SettingsButtonProps {
    onClick?: () => void | undefined;
    link?: boolean;
    href?: string;
    danger?: boolean;
    optionalText?: string;
    secondaryText?: string;
    disabled?: boolean;
}

class SettingsButton extends Component<SettingsButtonProps> {
    private handleLink = (e: Event) => {
        if (this.props.disabled) {
            e.preventDefault();
        }
    }

    public render(
        {
            onClick,
            link,
            href,
            danger,
            optionalText,
            secondaryText,
            disabled,
            children,
        }: RenderableProps<SettingsButtonProps>,
    ) {
        if (link) {
            return (
                <a className={[style.container, danger ? style.danger : '', disabled ? style.disabled : ''].join(' ')} href={disabled ? '#' : href} onClick={this.handleLink}>
                    <span className={style.children}>{children}</span>
                    {
                        secondaryText && (
                            <span className={style.secondaryText}>{secondaryText}</span>
                        )
                    }
                    {
                        optionalText && (
                            <span className={style.optionalText}>{optionalText}</span>
                        )
                    }
                    <svg
                        style={secondaryText ? 'margin-left: auto;' : ''}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </a>
            );
        }
            return (
                <button className={[style.container, danger ? style.danger : '', disabled ? style.disabled : ''].join(' ')} onClick={!disabled ? onClick : undefined}>
                    <span className={style.children}>{children}</span>
                    {
                        secondaryText && (
                            <span className={style.secondaryText}>{secondaryText}</span>
                        )
                    }
                    {
                        optionalText && (
                            <span className={style.optionalText}>{optionalText}</span>
                        )
                    }
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            );
        
  }
}

export { SettingsButton };
