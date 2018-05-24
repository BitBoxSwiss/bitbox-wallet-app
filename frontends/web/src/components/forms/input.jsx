import { h } from 'preact';
import { input, errorText } from './input.css';

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
    ...props,
}) {
    return (
        <div className={[input, className].join(' ')} style={style}>
            {
                label && (
                    <div class="flex flex-row flex-between flex-items-start">
                        <label for={id} class={error ? errorText : ''}>
                            {label}
                            {
                                error && (
                                    <span>:<span>{error}</span></span>
                                )
                            }
                        </label>
                    </div>
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
