import { h } from 'preact';
import style from './input.css';

export default function Input({
    disabled, label, id,
    children, getRef, ...props
}) {
    return (
        <div className={style.input}>
            <label for={id}>{label}</label>
            <input
                id={id}
                disabled={disabled}
                ref={getRef}
                {...props}
            />
            {children}
        </div>
    );
}
