import { Component } from 'preact';
import { Router } from 'preact-router';

import Header from './header';
import Wallet from '../routes/wallet';
import Options from '../routes/options';
import Dialog from './dialog';
import Login from './login';
import Seed from './seed';
import Initialize from './initialize';
import ManageBackups from './manage-backups';

import style from './style';

import { apiGet, apiWebsocket } from '../util';

const DeviceStatus = Object.freeze({
    UNREGISTERED: "unregistered",
    INITIALIZED: "initialized",
    UNINITIALIZED: "uninitialized",
    LOGGED_IN: "logged_in",
    SEEDED: "seeded"
});

class Seeded extends Component {
    render({ walletInitialized, registerOnWalletChanged }) {
        return (
            <div class={style.container}>
              <Header/>
              <Router onChange={this.handleRoute}>
                <Wallet
                  path="/"
                  registerOnWalletChanged={registerOnWalletChanged}
                  walletInitialized={walletInitialized}
                  />
                <Options path="/options/"/>
                <ManageBackups
                  path="/manage-backups"
                  showCreate={true}
                  />
              </Router>
            </div>
        );
    }
}

export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            deviceStatus: DeviceStatus.UNREGISTERED,
            walletInitialized: false
        };
    }

    /** Gets fired when the route changes.
     *@param {Object} event"change" event from [preact-router](http://git.io/preact-router)
     *@param {string} event.urlThe newly routed URL
     */
    handleRoute = e => {
        this.currentUrl = e.url;
    };

    componentDidMount() {
        apiGet("device/status").then(this.handleDeviceStatusChange);
        apiWebsocket(data => {
            switch(data.type) {
            case "wallet":
                if(data.data == "initialized") {
                    this.setState({ walletInitialized: true });
                } else if(data.data == "uninitialized") {
                    this.setState({ walletInitialized: false });
                }
            case "sync":
                if(data.data == "done") {
                    if(this.onWalletChanged) {
                        this.onWalletChanged();
                    }
                }
                break;
            case "deviceStatus":
                this.handleDeviceStatusChange(data.data);
                break;
            }
        });
    }

    handleDeviceStatusChange = deviceStatus => {
        this.setState({deviceStatus: deviceStatus});
    }

    render({}, { walletInitialized, deviceStatus }) {
        switch(deviceStatus) {
        case DeviceStatus.UNREGISTERED:
            return (
                <Dialog>
                  Waiting for device...
                </Dialog>
            );
        case DeviceStatus.INITIALIZED:
            return <Login/>;
        case DeviceStatus.UNINITIALIZED:
            return <Initialize/>;
        case DeviceStatus.LOGGED_IN:
            return <Seed/>;
        case DeviceStatus.SEEDED:
            return <Seeded
            registerOnWalletChanged={onWalletChanged => {this.onWalletChanged = onWalletChanged;}}
            walletInitialized={walletInitialized}
                />;
        };
    }
}
