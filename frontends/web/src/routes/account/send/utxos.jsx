import { Component } from 'preact';
import { apiGet } from '../../../utils/request';
import { Button, Checkbox } from '../../../components/forms';
import Rates from '../../../components/rates/rates';
import style from './utxos.css';

export default class UTXOs extends Component {
    constructor(props) {
        super(props);
        this.state = {
            show: false,
            utxos: [],
            selectedUTXOs: [],
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

    render({
        fiat,
        children,
    }, {
        show,
        utxos,
        selectedUTXOs,
    }) {
        return (
            <div class="row">
                <div class="subHeaderContainer first">
                    {children}
                    {
                        show ? (
                            <Button transparent onClick={this.hide}>
                                Hide coin control
                            </Button>
                        ) : (
                            <Button transparent onClick={() => this.setState({ show: true })}>
                                Show coin control
                            </Button>
                        )
                    }
                </div>
                <div>
                    <div class={[style.container, show ? style.expanded : style.collapsed].join(' ')}>
                        {
                            show && (
                                <table className={style.table}>
                                    {
                                        utxos.map(utxo => (
                                            <tr>
                                                <td>
                                                    <Checkbox
                                                        checked={!!selectedUTXOs[utxo.outPoint]}
                                                        id={'utxo-' + utxo.outPoint}
                                                        data-outpoint={utxo.outPoint}
                                                        onChange={this.handleUTXOChange}
                                                    />
                                                </td>
                                                <td>
                                                    <span><label>Outpoint:</label> {utxo.outPoint}</span>
                                                    <span><label>Address:</label> {utxo.address}</span>
                                                </td>
                                                <td class={style.right}>
                                                    <table class={style.amountTable} align="right">
                                                        <tr>
                                                            <td>{utxo.amount.amount}</td>
                                                            <td>{utxo.amount.unit}</td>
                                                        </tr>
                                                        <Rates tableRow unstyled amount={utxo.amount} fiat={fiat} />
                                                    </table>
                                                </td>
                                            </tr>
                                        ))
                                    }
                                </table>
                            )
                        }
                    </div>
                </div>
            </div>
        );
    }
}
