import { h } from 'preact';
import style from './checkbox.css';

export default function Checkbox({
    disabled, label, id,
    children, ...props
}) {
    return (
        <span className={style.checkbox}>
            <input
                type="checkbox"
                id={id}
                disabled={disabled}
                {...props}
            />
            <label for={id}>{label}</label>
        </span>
    );
}
