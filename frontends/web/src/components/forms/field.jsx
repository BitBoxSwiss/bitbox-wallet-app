import { h } from 'preact';
import style from './field.css';

export default function Button({
    children, ...props
}) {
    return (
        <div className={style.field} {...props}>
            {children}
        </div>
    );
}
