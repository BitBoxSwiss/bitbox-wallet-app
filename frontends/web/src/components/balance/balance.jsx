import { h } from 'preact';
import style from './style.css';

export default function Balance({ name, amount, children }) {
    return (
        <header className={style.balance}>
            <h2>{ name }</h2>
            <h2 className={style.amount}>{ amount }</h2>
            {children}
        </header>
    );
}
