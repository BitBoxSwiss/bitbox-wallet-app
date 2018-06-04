import { h } from 'preact';
import { apiPost } from '../../utils/request';
import style from './anchor.css';

export default function A({ href, children }) {
    return (
        <span className={style.link} onClick={() => apiPost('open', href)}>
            {children}
        </span>
    );
}
