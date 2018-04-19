import { h } from 'preact';
import style from './input.css';

export default function Input({
    disabled, label, id,
    children, ...props
}) {
    return (
        <div className={style.input}>
            <label for={id}>{label}</label>
            <input
                id={id}
                disabled={disabled}
                {...props}
            />
            {children}
        </div>
    );
}
