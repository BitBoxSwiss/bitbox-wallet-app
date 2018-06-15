import UpdatingComponent from '../updating/updating';
import style from './rates.css';

const currencies = [ 'usd', 'eur', 'chf', 'gbp' ];

export default class Rates extends UpdatingComponent {
    constructor(props) {
        super(props);
        this.state = { currency: props.currency };
    }

    map = [ { url: 'coins/btc/rates', key: 'rates' } ];

    render({ amount, children }, { currency, rates }) {
        if (!rates) {
            return null;
        }
        const value = rates[currency] * Number(amount);
        return (
            <span className={style.rates} onClick={() => {
                const position = (currencies.indexOf(currency) + 1) % currencies.length;
                this.setState({ currency: currencies[position] });
            }}>
                {children}
                {value.toFixed(2)}
                {' '}
                <span>{currency.toUpperCase()}</span>
            </span>
        );
    }
}
