import { Component } from 'preact';
import { apiGet } from '../../../utils/request';
import { Button, Input } from '../../../components/forms';
import QRCode from './qrcode';
import style from './receive.css';

export default class ReceiveButton extends Component {
    state = {
        receiveAddress: null
    }

    componentDidMount() {
        apiGet('wallet/' + this.props.code + '/receive-address').then(address => {
            this.setState({ receiveAddress: address });
        });
    }

    onReceive = () => {
        this.setState({ receiveAddress: null });
        apiGet('wallet/' + this.props.code + '/receive-address').then(address => {
            this.setState({ receiveAddress: address });
        });
        this.dialog.MDComponent.show();
    }

    render({}, { receiveAddress }) {
        return (
            <div class="innerContainer">
                <div class="header">
                    <h2>Get Coins</h2>
                </div>
                <div class="content isVerticallyCentered">
                    <div class={style.receiveContent}>
                        {
                            receiveAddress ? (
                                <div>
                                    <p class="label">Your bitcoin address</p>
                                    <QRCode data={receiveAddress} />
                                    <Input
                                        readOnly
                                        className={style.addressField}
                                        onFocus={focus}
                                        value={receiveAddress} />
                                </div>
                            ) : (
                                'loading…'
                            )
                        }
                    </div>
                </div>
                <div class="flex flex-row flex-end">
                    <Button primary onClick={this.props.onClose}>Cancel</Button>
                </div>
            </div>
        );
    }
}

function focus(e) {
    e.target.select();
}
