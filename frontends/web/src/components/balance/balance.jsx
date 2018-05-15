import { h } from 'preact';
import style from './balance.css';

export default function Balance({ name, balance, children }) {
    if (!balance) {
        return (
            <header className={style.balance}></header>
        );
    }
    return (
        <header className={style.balance}>
            <h2 className={style.amount}>
                {balance.available}
                {' '}
                <span className={style.unit}>{balance.unit}</span>
            </h2>
            {children}
        </header>
    );
}
