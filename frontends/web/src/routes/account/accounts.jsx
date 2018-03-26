// TODO: this component will be part of the sidebar.jsx

import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Account from './account';

import { translate } from 'react-i18next';

import { apiURL, apiGet, apiPost } from '../../utils/request';

@translate()
export default class Accounts extends Component {
    constructor(props) {
        super(props);
        this.onWalletEvents = {};
        this.state = {
            wallets: [],
            activeWallet: null
        };
    }

    componentDidMount() {
        this.props.registerOnWalletEvent(function(data) {
            if (this.onWalletEvents[data.code]) {
                this.onWalletEvents[data.code](data);
            } else {
                console.log("ignoring event for wallet " + data.code);
            }
        }.bind(this));
        apiGet("device/info").then(({ sdcard }) => {
            if(sdcard) {
                alert("Keep the SD card stored securely unless you want to manage backups.");
            }
        });
        apiGet("wallets").then(wallets => {
            this.setState({ wallets: wallets, activeWallet: wallets.length ? wallets[0] : null });
        });
    }

    render({}, { wallets, activeWallet }) {
        const this_ = this;
        function renderCoinButton(wallet) {
            return (
                <Button primary={true} raised={true} onClick={ () => {
                    this_.setState({ activeWallet: wallet });
                }} style="margin-right: 4px">{ wallet.name }</Button>
            );
        }
        function renderWallet(wallet) {
            return (
                <Account
                    wallet={ wallet }
                    show={ activeWallet.code == wallet.code }
                    registerOnWalletEvent={ onWalletEvent => { this_.onWalletEvents[wallet.code] = onWalletEvent; }}
                    />
            );
        }
        return (
            <div>
                { wallets.map(renderCoinButton) }
                { wallets.map(renderWallet) }
            </div>
        );
    }
}
