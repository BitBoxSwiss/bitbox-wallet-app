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

const DeviceState = Object.freeze({
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
            deviceState: DeviceState.UNREGISTERED,
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
        apiGet("deviceState").then(this.handleDeviceStateChange);
        apiWebsocket(data => {
            switch(data.type) {
            case "wallet":
                if(data.data == "initialized") {
                    this.setState({ walletInitialized: true });
                }
            case "sync":
                console.log(data.data);
                if(data.data == "done") {
                    if(this.onWalletChanged) {
                        this.onWalletChanged();
                    }
                }
                break;
            case "deviceState":
                this.handleDeviceStateChange(data.data);
                break;
            }
        });
    }

    handleDeviceStateChange = deviceState => {
        this.setState({deviceState: deviceState});
    }

    render({}, { walletInitialized, deviceState }) {
        switch(deviceState) {
        case DeviceState.UNREGISTERED:
            return (
                <Dialog>
                  Waiting for device...
                </Dialog>
            );
        case DeviceState.INITIALIZED:
            return <Login/>;
        case DeviceState.UNINITIALIZED:
            return <Initialize/>;
        case DeviceState.LOGGED_IN:
            return <Seed/>;
        case DeviceState.SEEDED:
            return <Seeded
            registerOnWalletChanged={onWalletChanged => {this.onWalletChanged = onWalletChanged;}}
            walletInitialized={walletInitialized}
                />;
        };
    }
}
