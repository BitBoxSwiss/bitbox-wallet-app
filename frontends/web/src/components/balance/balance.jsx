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
            <table className={style.balanceTable}>
                <tr>
                    <th className={['label', style.label].join(' ')}>{name}</th>
                </tr>
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
