import { h } from 'preact';
import style from './radio.css';

export default function Radio({
    disabled,
    label,
    id,
    children,
    sizeMedium,
    ...props,
}) {
    return (
        <span className={[style.radio, sizeMedium ? style.textMedium : ''].join(' ')}>
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
