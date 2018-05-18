import { Component } from 'preact';
import { Router, route } from 'preact-router';
import { translate } from 'react-i18next';

import { apiGet } from './utils/request';
import { apiWebsocket } from './utils/websocket';
import Sidebar from './components/sidebar/sidebar';
import Waiting from './routes/device/waiting';
import Device from './routes/device/device';
import Account from './routes/account/account';
import Settings from './routes/settings/settings';
import ManageBackups from './routes/device/manage-backups/manage-backups';
import Alert from './components/alert/Alert';
import { debug } from './utils/env';

@translate()
export default class App extends Component {
    state = {
        walletInitialized: false,
        deviceIDs: [],
        testing: false,
        wallets: [],
        activeWallet: null,
    }

    /** Gets fired when the route changes.
     *@param {Object} event"change" event from [preact-router](http://git.io/preact-router)
     *@param {string} event.urlThe newly routed URL
     */
    handleRoute = e => {
        // console.log(e.url);
    };

    componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.onWalletStatusChanged();
        this.unsubscribe = apiWebsocket(data => {
            switch (data.type) {
            case 'backend':
                switch (data.data) {
                case 'walletStatusChanged':
                    this.onWalletStatusChanged();
                    break;
                }
                break;
            case 'devices':
                switch (data.data) {
                case 'registeredChanged':
                    this.onDevicesRegisteredChanged();
                    break;
                }
                break;
            }
        });

        if (debug) {
            apiGet('testing').then(testing => this.setState({ testing }));
        }
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    onDevicesRegisteredChanged = () => {
        apiGet('devices/registered').then(deviceIDs => {
            this.setState({ deviceIDs });
        });
    }

    onWalletStatusChanged = () => {
        apiGet('wallet-status').then(status => {
            this.setState({
                walletInitialized: status === 'initialized'
            });
            if (this.state.walletInitialized) {
                apiGet('wallets').then(wallets => {
                    this.setState({ wallets, activeWallet: wallets && wallets.length ? wallets[0] : null });
                });
            }
        });
    }

    render({ t }, { deviceIDs, walletInitialized, wallets, activeWallet, testing }) {
        if (wallets && wallets.length && walletInitialized) {
            return (
                <div style="display: flex; flex: 1 1 auto;">
                    <Sidebar
                        accounts={wallets}
                        activeWallet={activeWallet}
                        deviceIDs={deviceIDs}
                    />
                    <Router onChange={this.handleRoute}>
                        <Redirect path="/" to={`/account/${wallets[0].code}`} />
                        <Account path="/account/:code" wallets={wallets} />
                        <Device path="/device/:deviceID" />
                        <Settings path="/settings" />
                        <ManageBackups
                            path="/manage-backups/:deviceID"
                            showCreate={true}
                            displayError={(msg) => { if (msg) alert("TODO" + msg); }}
                        />
                    </Router>
                    <Alert />
                </div>
            );
        }
        if (!deviceIDs.length) {
            return <Waiting testing={testing} />;
        }
        return <Device deviceID={deviceIDs[0]} />;
    }
}

class Redirect extends Component {
    componentWillMount() {
        route(this.props.to, true);
    }

    render() {
        return null;
    }
}
