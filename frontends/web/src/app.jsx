import { Component } from 'preact';
import { translate } from 'react-i18next';

import { Button } from './components/forms';
import { BitBox } from './components/icon/logo';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import Dialog from './components/dialog/dialog';
import Device from './routes/device/device';

import { Router, route } from 'preact-router';
import Account from './routes/account/account';
import ManageBackups from './routes/device/manage-backups/manage-backups';

import Alert from './components/alert/Alert';
import Sidebar from './components/sidebar/sidebar';

import { apiGet, apiPost } from './utils/request';
import { apiWebsocket } from './utils/websocket';

import { debug } from './utils/env';

import style from './components/app.css';

@translate()
export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            walletInitialized: false,
            deviceIDs: [],
            testing: false,
            wallets: [],
            activeWallet: null,
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
                walletInitialized: status == "initialized"
            });
            if (this.state.walletInitialized) {
                apiGet('wallets').then(wallets => {
                    this.setState({ wallets, activeWallet: wallets && wallets.length ? wallets[0] : null });
                });
            }
        });
    }

    render({}, { deviceIDs, walletInitialized, wallets, activeWallet, testing }) {
        if (wallets && wallets.length != 0 && walletInitialized) {
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
        if (deviceIDs.length == 0) {
            return (
                <div className={style.container}>
                    {BitBox}
                    <div className={style.content}>
                        <h3>Waiting for device...</h3>
                        <SkipForTestingButton show={debug && testing}/>
                    </div>
                </div>
            );
        }
        return <Device deviceID={deviceIDs[0]} />;
    }
}

class SkipForTestingButton extends Component {
    constructor(props) {
        super(props);
        this.state = {
            testPIN: ""
        };
    }

    registerTestingDevice = () => {
        apiPost('test/register', { pin: this.state.testPIN });
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    render({ show }, { testPIN }) {
        if (!show) {
            return;
        }
        return (
            <form onsubmit={this.registerTestingDevice}>
              <Textfield
                type="password"
                autoComplete="off"
                id="testPIN"
                label="Test PIN"
                onInput={this.handleFormChange}
                value={testPIN}
                />
              <Button type="submit" primary={true} raised={true}>
                Skip for Testing
              </Button>
            </form>
        );
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
