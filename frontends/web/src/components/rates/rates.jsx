import UpdatingComponent from '../updating/updating';
import style from './rates.css';

export default class Rates extends UpdatingComponent {
    constructor(props) {
        super(props);

        let coin = props.amount.unit;
        if (coin.length === 4 && coin.startsWith('T')) {
            coin = coin.substring(1);
        }
        this.state = { coin, currency: 'USD' };
    }

    map = [ { url: 'coins/rates', key: 'rates' } ];

    handleChangeCurrency = e => {
        this.setState(state => {
            const currencies = Object.keys(state.rates[state.coin]);
            const position = (currencies.indexOf(state.currency) + 1) % currencies.length;
            return { currency: currencies[position] };
        });
    }

    render({ amount, children }, { coin, currency, rates }) {
        if (!rates) {
            return null;
        }
        const value = rates[coin][currency] * Number(amount.amount);
        return (
            <span className={style.rates} onClick={this.handleChangeCurrency}>
                {children}
                {value.toFixed(2)}
                {' '}
                <span className={style.unit}>{currency}</span>
            </span>
        );
    }
}
