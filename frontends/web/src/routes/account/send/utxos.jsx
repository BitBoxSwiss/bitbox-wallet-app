import { Component } from 'preact';
import { apiGet } from '../../../utils/request';
import { Button } from '../../../components/forms';
import Rates from '../../../components/rates/rates';
import style from './utxos.css';

export default class UTXOs extends Component {
    constructor(props) {
        super(props);
        this.state = {
            show: false,
            utxos: [],
            selectedUTXOs: []
        };
    }

    componentDidMount() {
        apiGet(`wallet/${this.props.walletCode}/utxos`).then(utxos => {
            this.setState({ utxos });
        });
    }

    clear = () => {
        this.setState({ show: false, selectedUTXOs: [] });
        this.props.onChange(this.state.selectedUTXOs);
    }

    handleUTXOChange = event => {
        let selectedUTXOs = Object.assign({}, this.state.selectedUTXOs);
        let outPoint = event.target.dataset.outpoint;
        if (event.target.checked) {
            selectedUTXOs[outPoint] = true;
        } else {
            delete selectedUTXOs[outPoint];
        }
        this.setState({ selectedUTXOs });
        this.props.onChange(this.state.selectedUTXOs);
    }

    hide = () =>  {
        this.setState({
            show: false,
            selectedUTXOs: []
        });
        this.props.onChange(this.state.selectedUTXOs);
    }

    render({ fiat }, { show, utxos, selectedUTXOs }) {
        if (!show) {
            return (
                <span>
                    <Button transparent onClick={() => this.setState({ show: true })}>
                        Show coin control
                    </Button>
                </span>
            );
        }
        return (
            <span>
                <Button transparent onClick={this.hide}>
                  Hide coin control
                </Button><br />
                <table className={style.table}>
                    <tr><th></th><th>Output</th><th>Amount</th></tr>
                    { utxos.map(utxo => (
                        <tr key={utxo.outPoint}>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={!!selectedUTXOs[utxo.outPoint]}
                                    id={'utxo-' + utxo.outPoint}
                                    data-outpoint={utxo.outPoint}
                                    onChange={this.handleUTXOChange}
                                />
                            </td>
                            <td>
                                <label for={'utxo-' + utxo.outPoint}>Outpoint: {utxo.outPoint}</label>
                                <label for={'utxo-' + utxo.outPoint}>Address: {utxo.address}</label>
                            </td>
                            <td>{utxo.amount.amount} {utxo.amount.unit}</td>
                            <td><Rates amount={utxo.amount} fiat={fiat} /></td>
                        </tr>
                    ))
                    }
                </table>
            </span>
        );
    }
}
