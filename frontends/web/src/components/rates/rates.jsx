import UpdatingComponent from '../updating/updating';
import style from './rates.css';

const currencies = [ 'usd', 'eur', 'chf', 'gbp' ];

export default class Rates extends UpdatingComponent {
    constructor(props) {
        super(props);
        this.state = { currency: props.currency };
    }

    map = [ { url: 'coins/btc/rates', key: 'rates' } ]

    handleChangeCurrency = e => {
        this.setState(state => {
            const position = (currencies.indexOf(state.currency) + 1) % currencies.length;
            return { currency: currencies[position] };
        });
    }

    render({ amount, children }, { currency, rates }) {
        if (!rates) {
            return null;
        }
        const value = rates[currency] * Number(amount);
        return (
            <span className={style.rates} onClick={this.handleChangeCurrency}>
                {children}
                {value.toFixed(2)}
                {' '}
                <span className={style.unit}>{currency.toUpperCase()}</span>
            </span>
        );
    }
}
