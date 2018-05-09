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
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
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
