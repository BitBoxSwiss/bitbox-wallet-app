import { h } from 'preact';
import style from './button.css';

export default function Button({
    primary, secondary,
    disabled,
    children, ...props
}) {

    const className = primary && 'primary'
        || secondary && 'secondary'
        || 'button';

    return (
        <button
            disabled={disabled}
            className={style[className]}
            {...props}
        >
            {children}
        </button>
    );
}
