import { h } from 'preact';
import { apiPost } from '../../utils/request';
import style from './anchor.css';

export default function A({ href, children, ...props }) {
    return (
        <span className={style.link} onClick={() => apiPost('open', href)} {...props}>
            {children}
        </span>
    );
}
