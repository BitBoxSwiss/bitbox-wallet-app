import { h } from 'preact';
import { input } from './input.css';

export default function Input({
    type = 'text',
    disabled, label, id,
    className, style,
    children, getRef, ...props
}) {
    return (
        <div className={[input, className].join(' ')} style={style}>
            {label && <label for={id}>{label}</label>}
            <input
                type={type}
                id={id}
                disabled={disabled}
                ref={getRef}
                {...props}
            />
            {children}
        </div>
    );
}
