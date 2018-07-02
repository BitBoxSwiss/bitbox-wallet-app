import { h } from 'preact';
import { input, errorText, isTransparent } from './input.css';

export default function Input({
    type = 'text',
    disabled,
    label,
    id,
    error,
    className,
    style,
    children,
    getRef,
    transparent,
    ...props
}) {
    return (
        <div className={[input, className, transparent ? isTransparent : ''].join(' ')} style={style}>
            {
                label && (
                    <label for={id} class={error ? errorText : ''}>
                        {label}
                        {
                            error && (
                                <span>:<span>{error}</span></span>
                            )
                        }
                    </label>
                )
            }
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
