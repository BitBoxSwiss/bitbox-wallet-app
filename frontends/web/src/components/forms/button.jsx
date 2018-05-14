import { h } from 'preact';
import { Link } from 'preact-router/match';
import style from './button.css';

export function ButtonLink({
    primary,
    secondary,
    transparent,
    danger,
    children,
    ...props
}) {
    const className = primary && 'primary'
        || secondary && 'secondary'
        || transparent && 'transparent'
        || danger && 'danger'
        || 'secondary';

    return (
        <Link className={style[className]} {...props}>
            {children}
        </Link>
    );
}

export default function Button({
    primary,
    secondary,
    transparent,
    danger,
    children,
    ...props
}) {
    const className = primary && 'primary'
        || secondary && 'secondary'
        || transparent && 'transparent'
        || danger && 'danger'
        || 'button';

    return (
        <button
            className={style[className]}
            {...props}>
            {children}
        </button>
    );
}
