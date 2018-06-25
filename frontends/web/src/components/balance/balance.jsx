import Rates from '../../components/rates/rates';
import style from './balance.css';

export default function Balance({ t, name, balance, fiat }) {
    if (!balance) {
        return (
            <header className={style.balance}></header>
        );
    }
    return (
        <header className={style.balance}>
            <span className={['label', style.label].join(' ')}>{name}</span>
            <span className={style.amount}>
                {balance.available.amount}
                {' '}
                <span className={style.unit}>{balance.available.unit}</span>
                <span className={style.balanceConversion}><Rates amount={balance.available} fiat={fiat} /></span>
            </span>
            {
                balance && balance.hasIncoming && (
                    <h5 class={style.pendingBalance}>
                        {balance.incoming.amount}
                        {' '}
                        {balance.incoming.unit}
                        {' '}
                        {t('account.incoming')}
                        <span className={style.incomingConversion}><Rates amount={balance.incoming} fiat={fiat} /></span>
                    </h5>
                )
            }
        </header>
    );
}
