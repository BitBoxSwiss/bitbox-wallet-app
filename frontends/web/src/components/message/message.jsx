import { h } from 'preact';
import style from './message.css';

export default function Message({
    type,
    children
}) {
    return (
        <div className={style[type] || style.message}>
            {children}
        </div>
    );
}
