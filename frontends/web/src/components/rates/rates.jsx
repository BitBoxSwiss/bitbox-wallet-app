import UpdatingComponent from '../updating/updating';
import style from './rates.css';

const currencies = [ 'USD', 'EUR', 'CHF', 'GBP' ];

export default class Rates extends UpdatingComponent {
    constructor(props) {
        super(props);
        this.state = { currency: props.currency };
    }

    map = [ { url: 'coins/rates', key: 'rates' } ];

    handleChangeCurrency = e => {
        this.setState(state => {
            const position = (currencies.indexOf(state.currency) + 1) % currencies.length;
            return { currency: currencies[position] };
        });
    }

    render({ coin, amount, children }, { currency, rates }) {
        if (!rates) {
            return null;
        }
        if (coin.length === 4 && coin.startsWith('T')) {
            coin = coin.substring(1);
        }
        const value = rates[coin][currency] * Number(amount);
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
