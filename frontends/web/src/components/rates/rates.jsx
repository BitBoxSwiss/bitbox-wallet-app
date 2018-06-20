import UpdatingComponent from '../updating/updating';
import style from './rates.css';

export default class Rates extends UpdatingComponent {
    constructor(props) {
        super(props);

        let coin = props.amount.unit;
        if (coin.length === 4 && coin.startsWith('T')) {
            coin = coin.substring(1);
        }
        this.state = { coin };
    }

    map = [ { url: 'coins/rates', key: 'rates' } ];

    render({ amount, children, fiat }, { coin, rates }) {
        if (!rates || !rates[coin]) {
            return null;
        }
        const value = rates[coin][fiat.code] * Number(amount.amount);
        return (
            <span className={style.rates} onClick={fiat.next}>
                {children}
                {formatAsCurrency(value)}
                {' '}
                <span className={style.unit}>{fiat.code}</span>
            </span>
        );
    }
}

function formatAsCurrency(amount) {
    let formatted = amount.toFixed(2);
    let position = formatted.indexOf('.') - 3;
    while (position > 0) {
        formatted = formatted.slice(0, position) + "'" + formatted.slice(position);
        position = position - 3;
    }
    return formatted;
}
