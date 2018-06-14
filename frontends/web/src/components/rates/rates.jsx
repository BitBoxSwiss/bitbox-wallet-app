import { h, Component } from 'preact';
import { apiWebsocket } from '../../utils/websocket';
import { apiGet } from '../../utils/request';

export default class Rates extends Component {
    state = {
        rates: null,
    }

    onDeviceStatus = ({ subject, object }) => {
        if (subject === 'coins/btc/rates') {
            this.setState({ rates: object });
        }
    }

    componentDidMount() {
        apiGet('coins/btc/rates').then(rates => {
            this.setState({ rates });
        });
        this.unsubscribe = apiWebsocket(this.onDeviceStatus);
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    render({ currency, amount, children }, { rates }) {
        if (!rates) { return null; }
        const value = rates[currency] * Number(amount);
        return (
            <span>
                { children + ' ' + value.toFixed(2) + ' ' + currency.toUpperCase() }
            </span>
        );
    }
}
