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

@translate()
export default class App extends Component {
    state = {
        walletInitialized: false,
        deviceIDs: [],
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
            case 'backend':
                switch (data) {
                case 'walletStatusChanged':
                    this.onWalletStatusChanged();
                    break;
                }
                break;
            // case 'device':
            //     switch (data) {
            //     case 'keystoreAvailable':
            //         this.onWalletStatusChanged();
            //         break;
            //     case 'keystoreGone':
            //         this.onWalletStatusChanged();
            //         break;
            //     }
            //     break;
            case 'devices':
                switch (data) {
                case 'registeredChanged':
                    this.onDevicesRegisteredChanged();
                    break;
                }
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

    render({ t }, { deviceIDs, walletInitialized }) {
        return (
            <div className="app">
                { walletInitialized && (<Sidebar deviceIDs={deviceIDs} />)}
                <Router onChange={this.handleRoute}>
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
                <Alert />
            </div>
        );
    }
}
