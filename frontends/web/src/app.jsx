import { Component } from 'preact';
import { translate } from 'react-i18next';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from './components/dialog/dialog';
import Bootloader from './routes/device/bootloader';
import Login from './routes/device/unlock';
import Seed from './routes/device/seed';
import Initialize from './routes/device/initialize';

import { Router } from 'preact-router';
import Account from './routes/account/account';
import Settings from './routes/settings/settings';
import ManageBackups from './routes/device/manage-backups/manage-backups';

import Sidebar from './components/sidebar/sidebar';

import { apiGet, apiPost, apiWebsocket } from './utils/request';

import style from './components/style';

const DeviceStatus = Object.freeze({
    BOOTLOADER: "bootloader",
    INITIALIZED: "initialized",
    UNINITIALIZED: "uninitialized",
    LOGGED_IN: "logged_in",
    SEEDED: "seeded"
});

@translate()
export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
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
        apiWebsocket(data => {
            switch(data.type) {
            case "wallet":
                if(this.onWalletEvent) {
                    this.onWalletEvent(data);
                }
                break;
            case "devices":
                switch(data.data) {
                case "registeredChanged":
                    this.onDevicesRegisteredChanged();
                    break;
                }
                break;
            case "device":
                switch(data.data) {
                case "statusChanged":
                    this.onDeviceStatusChanged();
                    break;
                }
                if(this.onBootloaderEvent) {
                    this.onBootloaderEvent(data);
                }
                break;
            }
        });
        apiGet("testing").then(testing => this.setState({ testing: testing }));

        apiGet("wallets").then(wallets => {
            this.setState({ wallets: wallets, activeWallet: wallets.length ? wallets[0] : null });
        });
    }

    onDevicesRegisteredChanged = () => {
        apiGet("devices/registered").then(registered => {
            this.setState({deviceRegistered: registered});
            this.onDeviceStatusChanged();
        });
    }

    onDeviceStatusChanged = () => {
        if(this.state.deviceRegistered) {
            apiGet("device/status").then(deviceStatus => {
                this.setState({deviceStatus: deviceStatus});
            });
        }
    }

    render({}, { wallets, activeWallet, deviceRegistered, deviceStatus, testing }) {

        // console.log('app state', this.state)

        function renderButtonIfTesting() {
            if (testing) {
                return (
                    <Button primary={true} raised={true} onClick={()=>{
                        apiPost("devices/test/register");
                    }}>Skip for Testing</Button>
                )
            }
        }

        if(!deviceRegistered || !deviceStatus) {
            return (
                <div style="text-align: center;">
                    <div style="margin: 30px;">
                        <Dialog>
                            Waiting for device...
                        </Dialog>
                    </div>
                    { renderButtonIfTesting() }
                </div>
            );
        }
        switch(deviceStatus) {
        case DeviceStatus.BOOTLOADER:
            return <Bootloader
            registerOnEvent={onEvent => {this.onBootloaderEvent = onEvent;}}
                />;
        case DeviceStatus.INITIALIZED:
            return <Login/>;
        case DeviceStatus.UNINITIALIZED:
            return <Initialize/>;
        case DeviceStatus.LOGGED_IN:
            return <Seed/>;
        case DeviceStatus.SEEDED:
            return (
              <div class={style.container}>
                <div style="display: flex; flex-grow: 1;">
                  <Sidebar accounts={wallets} activeWallet={activeWallet} />
                  <Router onChange={this.handleRoute}>
                    <div path="/"><h1>Welcome</h1></div>
                    <Account path="/account/:code" wallets={wallets}
                      registerOnWalletEvent={onWalletEvent => {this.onWalletEvent = onWalletEvent;}}
                    />
                    <Settings path="/settings/" />
                    <ManageBackups
                      path="/manage-backups"
                      showCreate={true}
                      />
                  </Router>
                </div>
              </div>
            );
        };
    }
}
