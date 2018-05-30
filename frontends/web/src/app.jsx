import { Component } from 'preact';
import { Router, route } from 'preact-router';
import { translate } from 'react-i18next';

import { apiGet } from './utils/request';
import { apiWebsocket } from './utils/websocket';
import Sidebar from './components/sidebar/sidebar';
import Device from './routes/device/device';
import Account from './routes/account/account';
import Settings from './routes/settings/settings';
import ManageBackups from './routes/device/manage-backups/manage-backups';
import Alert from './components/alert/Alert';
import Status from './components/status/status';

@translate()
export default class App extends Component {
    state = {
        backendConnected: true,
        walletInitialized: false,
        deviceIDs: [],
        update: null,
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
        this.unsubscribe = apiWebsocket(({ type, data }) => {
            switch (type) {
            case 'frontend': // special event from websocket.js
                if (data == 'closed') {
                    this.setState({ backendConnected: false });
                }
                break;
            case 'backend':
                switch (data) {
                case 'walletStatusChanged':
                    this.onWalletStatusChanged();
                    break;
                }
                break;
            case 'device':
                switch (data) {
                case 'keystoreAvailable':
                    this.onWalletStatusChanged();
                    break;
                case 'keystoreGone':
                    this.onWalletStatusChanged();
                    break;
                }
                break;
            case 'devices':
                switch (data) {
                case 'registeredChanged':
                    this.onDevicesRegisteredChanged();
                    break;
                }
                break;
            case 'update':
                this.setState({ update: data });
                break;
            }
        });
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
            const walletInitialized = status === 'initialized';
            this.setState({
                walletInitialized
            });
            if (!walletInitialized) {
                // console.log('uninitialized! route to /')
                route('/', true);
            }
        });
    }

    render({ t }, { backendConnected, deviceIDs, walletInitialized, update }) {
        if (!backendConnected) {
            return (
                <div className="app" style="padding: 40px">
                    An error occurred. Please restart the application.
                </div>
            );
        }
        return (
            <div className="app">
                { walletInitialized && (<Sidebar deviceIDs={deviceIDs} />)}
                <div class="flex-column flex-1">
                    { update && <Status dismissable keyName={`update-${update.version}`} type="info">
                        A new version of this app is available! We recommend that you upgrade
                        from { update.current } to { update.version }. { update.description }
                        &nbsp;<a href="https://shiftcrypto.ch/start" target="_blank">Download</a>
                    </Status> }
                    <Router onChange={ this.handleRoute.bind(this) }>
                        {/*
                        <Redirect path="/" to={`/account/${wallets[0].code}`} />
                        */}
                        <Account path="/account/:code?" deviceIDs={deviceIDs} />
                        <Settings path="/settings" deviceIDs={deviceIDs} />
                        <ManageBackups
                            path="/manage-backups/:deviceID"
                            showCreate={true}
                            displayError={(msg) => { if (msg) alert("TODO" + msg); }}
                            deviceIDs={deviceIDs} />
                        <Device path="/device/:deviceID" deviceIDs={deviceIDs} />
                        <Device
                            default
                            deviceID={deviceIDs[0]}
                            deviceIDs={deviceIDs} />
                    </Router>
                </div>
                <Alert />
            </div>
        );
    }
}
