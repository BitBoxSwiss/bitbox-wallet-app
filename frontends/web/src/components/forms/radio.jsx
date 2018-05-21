import { h } from 'preact';
import style from './radio.css';

export default function Radio({
    disabled,
    label,
    id,
    children,
    className,
    ...props,
}) {
    return (
        <span className={style.radio}>
            <input
                type="radio"
                id={id}
                name={id}
                disabled={disabled}
                {...props}
            />
            <label for={id}>
                {label}
                {children}
            </label>
        </span>
    );
}
