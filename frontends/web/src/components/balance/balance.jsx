import { h } from 'preact';
import style from './balance.css';

export default function Balance({ name, amount, unit, children }) {
    if (!amount || amount === '0') {
        return (
            <header className={style.balance}>
                {children}
            </header>
        );
    }
    return (
        <header className={style.balance}>
            <h2 className={style.amount}>
                {amount}
                {' '}
                <span className={style.unit}>{unit}</span>
            </h2>
            {children}
        </header>
    );
}
