import { h } from 'preact';
import style from './button.css';

export default function Button({
    primary, secondary, danger,
    disabled,
    children, ...props
}) {

    const className = primary && 'primary'
        || secondary && 'secondary'
        || danger && 'danger'
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
