import { h, RenderableProps } from 'preact';
import * as style from './badge.css';

interface BadgeProps {
    type: string;
    className?: string;
}

function Badge({
    type,
    className,
    children
}: RenderableProps<BadgeProps>): JSX.Element {
    return (
        <span className={[style.container, style[type], className].join(' ')}>
            {children}
        </span>
    );
}

export { Badge };
