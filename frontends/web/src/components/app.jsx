import { Component } from 'preact';
import { Router } from 'preact-router';
import Header from './header';
import Wallets from '../routes/wallet';
import Options from '../routes/options';
import Dialog from './dialog';
import Login from './login';
import Seed from './seed';
import Initialize from './initialize';
import ManageBackups from './manage-backups';

import style from './style';

import { translate } from 'react-i18next';

import { apiGet, apiWebsocket } from '../util';

const DeviceStatus = Object.freeze({
    UNREGISTERED: "unregistered",
    INITIALIZED: "initialized",
    UNINITIALIZED: "uninitialized",
    LOGGED_IN: "logged_in",
    SEEDED: "seeded"
});

class Seeded extends Component {
    constructor(props) {
        super(props);
    }

    render({ registerOnWalletEvent }) {
        return (
            <div class={style.container}>
              <Header/>
              <Router onChange={this.handleRoute}>
                <Wallets
                  path="/"
                  registerOnWalletEvent={registerOnWalletEvent}
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

@translate()
export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            deviceStatus: DeviceStatus.UNREGISTERED
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
                if(this.onWalletEvent) {
                    this.onWalletEvent(data);
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

    render({}, { deviceStatus }) {
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
            registerOnWalletEvent={onWalletEvent => {this.onWalletEvent = onWalletEvent;}}
                />;
        };
    }
}
