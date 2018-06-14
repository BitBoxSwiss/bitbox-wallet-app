import UpdatingComponent from '../updating/updating';

export default class Rates extends UpdatingComponent {
    map = [ { url: 'coins/btc/rates', key: 'rates' } ];

    render({ currency, amount, children }, { rates }) {
        if (!rates) {
            return null;
        }
        const value = rates[currency] * Number(amount);
        return (
            <span>
                { children + ' ' + value.toFixed(2) + ' ' + currency.toUpperCase() }
            </span>
        );
    }
}
