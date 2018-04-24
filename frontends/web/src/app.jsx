import { Component } from 'preact';
import { translate } from 'react-i18next';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from './components/dialog/dialog';
import Bootloader from './routes/device/bootloader';
import Login from './routes/device/unlock';
import Seed from './routes/device/seed';
import Initialize from './routes/device/initialize';

import { Router, route } from 'preact-router';
import Account from './routes/account/account';
import Settings from './routes/settings/settings';
import ManageBackups from './routes/device/manage-backups/manage-backups';

import Sidebar from './components/sidebar/sidebar';

import { apiGet, apiPost } from './utils/request';
import { apiWebsocket } from './utils/websocket';

import { debug } from './utils/env';

import style from './components/style';

const DeviceStatus = Object.freeze({
    BOOTLOADER: 'bootloader',
    INITIALIZED: 'initialized',
    UNINITIALIZED: 'uninitialized',
    LOGGED_IN: 'logged_in',
    SEEDED: 'seeded'
});

@translate()
export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            walletInitialized: false,
            deviceRegistered: false,
            deviceStatus: null,
            testing: false,
            wallets: [],
            activeWallet: null
        };
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
            case "backend":
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
            case 'device':
                switch (data.data) {
                case 'statusChanged':
                    this.onDeviceStatusChanged();
                    break;
                }
                break;
            }
        });

        if (debug) {
            apiGet('testing').then(testing => this.setState({ testing }));
        }

        apiGet('wallets').then(wallets => {
            this.setState({ wallets, activeWallet: wallets.length ? wallets[0] : null });
        });
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    onDevicesRegisteredChanged = () => {
        apiGet('devices/registered').then(registered => {
            // reset deviceStatus, otherwise a previous (but now
            // invalid) component will be rendered before it is
            // updated below.
            this.setState({
                deviceRegistered: registered,
                deviceStatus: null
            });
            this.onDeviceStatusChanged();
        });
    }

    onWalletStatusChanged = () => {
        apiGet('wallet-status').then(status => {
            this.setState({
                walletInitialized: status == "initialized"
            });
        });
    }

    onDeviceStatusChanged = () => {
        if (this.state.deviceRegistered) {
            apiGet('device/status').then(deviceStatus => {
                this.setState({ deviceStatus });
            });
        }
    }

    render({}, { walletInitialized, wallets, activeWallet, deviceRegistered, deviceStatus, testing }) {
        if (wallets && wallets.length != 0 && walletInitialized) {
            return (
                <div class={style.container}>
                    <div style="display: flex; flex: 1 1 auto;">
                        <Sidebar accounts={wallets} activeWallet={activeWallet} />
                        <Router onChange={this.handleRoute}>
                            <Redirect path="/" to={`/account/${wallets[0].code}`} />
                            <Account path="/account/:code" wallets={wallets} />
                            <Settings path="/settings/" />
                            <ManageBackups
                                path="/manage-backups"
                                showCreate={true}
                            />
                        </Router>
                    </div>
                </div>
            );
        }
        if (!deviceRegistered || !deviceStatus) {
            return (
                <Dialog>
                    <h3>Waiting for device...</h3>
                    { debug && testing && renderButtonIfTesting() }
                </Dialog>
            );
        }
        switch (deviceStatus) {
        case DeviceStatus.BOOTLOADER:
            return <Bootloader />;
        case DeviceStatus.INITIALIZED:
            return <Login />;
        case DeviceStatus.UNINITIALIZED:
            return <Initialize />;
        case DeviceStatus.LOGGED_IN:
            return <Seed />;
        }
    }
}

function renderButtonIfTesting() {
    return (
        <Button primary={true} raised={true} onClick={registerTestingDevice}>
            Skip for Testing
        </Button>
    );
}

function registerTestingDevice() {
    apiPost('test/register');
}

class Redirect extends Component {
    componentWillMount() {
        route(this.props.to, true);
    }

    render() {
        return null;
    }
}
