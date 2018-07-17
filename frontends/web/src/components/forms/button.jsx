import { h } from 'preact';
import { Link } from 'preact-router/match';
import style from './button.css';

export function ButtonLink({
    primary,
    secondary,
    transparent,
    danger,
    className,
    tabIndex = '0',
    children,
    disabled,
    ...props
}) {
    const classNames = [
        style[primary && 'primary'
        || secondary && 'secondary'
        || transparent && 'transparent'
        || danger && 'danger'
        || 'button'
        ], className
    ].join(' ');

    if (disabled) {
        return (
            <Button
                primary={primary}
                secondary={secondary}
                transparent={transparent}
                danger={danger}
                children={children}
                disabled={disabled}
                {...props} />
        );
    }
    return (
        <Link className={classNames} tabIndex={tabIndex} {...props}>
            {children}
        </Link>
    );
}

export default function Button({
    type = 'button',
    primary,
    secondary,
    transparent,
    danger,
    className,
    children,
    ...props
}) {
    const classNames = [
        style[primary && 'primary'
        || secondary && 'secondary'
        || transparent && 'transparent'
        || danger && 'danger'
        || 'button'
        ], className
    ].join(' ');

    return (
        <button
            type={type}
            className={classNames}
            {...props}>
            {children}
        </button>
    );
}
