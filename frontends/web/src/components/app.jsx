import { Component } from 'preact';
import { Router } from 'preact-router';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Header from './header';
import Wallets from '../routes/wallet';
import Options from '../routes/options';
import Dialog from './dialog';
import Bootloader from './bootloader';
import Login from './login';
import Seed from './seed';
import Initialize from './initialize';
import ManageBackups from './manage-backups';

import style from './style';

import { translate } from 'react-i18next';

import { apiGet, apiPost, apiWebsocket } from '../util';

const DeviceStatus = Object.freeze({
    BOOTLOADER: "bootloader",
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
            deviceRegistered: false,
            deviceStatus: null
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

    render({}, { deviceRegistered, deviceStatus }) {
        if(!deviceRegistered || !deviceStatus) {
            return (
                <div style="text-align: center;">
                    <div style="margin: 30px;">
                        <Dialog>
                            Waiting for device...
                        </Dialog>
                    </div>
                    <Button primary={true} raised={true} onClick={()=>{
                        apiPost("devices/test/register");
                    }}>Skip for Testing</Button>
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
            return <Seeded
            registerOnWalletEvent={onWalletEvent => {this.onWalletEvent = onWalletEvent;}}
                />;
        };
    }
}
