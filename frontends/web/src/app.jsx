import { Component } from 'preact';
import { translate } from 'react-i18next';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from './components/dialog/dialog';
import Bootloader from './routes/device/bootloader';
import Login from './routes/device/unlock';
import Seed from './routes/device/seed';
import Initialize from './routes/device/initialize';

import Routes from './routes';

import { apiGet, apiPost, apiWebsocket } from './utils/request';

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
            testing: false
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
        apiGet("testing").then(testing => this.setState({ testing: testing }));
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

    render({}, { deviceRegistered, deviceStatus, testing }) {
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
            return <Routes
            registerOnWalletEvent={onWalletEvent => {this.onWalletEvent = onWalletEvent;}}
                />;
        };
    }
}
