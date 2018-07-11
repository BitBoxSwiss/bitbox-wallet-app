import Rates from '../../components/rates/rates';
import style from './balance.css';

export default function Balance({
    t,
    name,
    balance,
    fiat,
}) {
    if (!balance) {
        return (
            <header className={style.balance}></header>
        );
    }
    return (
        <header className={style.balance}>
            <div class={['label', style.label].join(' ')}>{name}</div>
            <table className={style.balanceTable}>
                <tr>
                    <td className={style.availableAmount}>{balance.available.amount}</td>
                    <td className={style.availableUnit}>{balance.available.unit}</td>
                </tr>
                <Rates tableRow amount={balance.available} fiat={fiat} />
            </table>
            {
                balance && balance.hasIncoming && (
                    <p class={style.pendingBalance}>
                        {t('account.incoming')} {balance.incoming.amount} {balance.incoming.unit} /
                        <span className={style.incomingConversion}> <Rates amount={balance.incoming} fiat={fiat} /></span>
                    </p>
                )
            }
        </header>
    );
}
