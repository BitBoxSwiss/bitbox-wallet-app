import { Component } from 'preact';

import Dialog from '../../components/dialog/dialog';
import Bootloader from '../device/bootloader';
import Login from '../device/unlock';
import Seed from '../device/seed';
import Initialize from '../device/initialize';
import Settings from '../settings/settings';

import { apiGet } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';

const DeviceStatus = Object.freeze({
    BOOTLOADER: 'bootloader',
    INITIALIZED: 'initialized',
    UNINITIALIZED: 'uninitialized',
    LOGGED_IN: 'logged_in',
    SEEDED: 'seeded'
});

export default class Device extends Component {
    constructor(props) {
        super(props);
        this.state = {
            deviceRegistered: false,
            deviceStatus: null,
        };
    }

    componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.unsubscribe = apiWebsocket(data => {
            console.log(data);
            if (data.type == 'devices' && data.data == 'registeredChanged') {
                this.onDevicesRegisteredChanged();
            }
            if (data.type == 'device' && data.deviceID == this.props.deviceID) {
                this.onDeviceStatusChanged();
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.deviceID !== prevProps.deviceID) {
            this.onDevicesRegisteredChanged();
        }
    }

    onDevicesRegisteredChanged = () => {
        apiGet('devices/registered').then(deviceIDs => {
            this.setState({
                deviceRegistered: deviceIDs.includes(this.props.deviceID),
                deviceStatus: null
            });
            if (this.state.deviceRegistered) {
                this.onDeviceStatusChanged();
            }
        });
    }

    onDeviceStatusChanged = () => {
        if (this.state.deviceRegistered) {
            apiGet('devices/' + this.props.deviceID + '/status').then(deviceStatus => {
                this.setState({ deviceStatus });
            });
        }
    }


    render({ deviceID }, { deviceRegistered, deviceStatus }) {
        if (!deviceRegistered || !deviceStatus) {
            return (
                <Dialog>
                  <h3>Waiting for device...</h3>
                </Dialog>
            );
        }
        switch (deviceStatus) {
        case DeviceStatus.BOOTLOADER:
            return <Bootloader deviceID={deviceID} />;
        case DeviceStatus.INITIALIZED:
            return <Login deviceID={deviceID} />;
        case DeviceStatus.UNINITIALIZED:
            return <Initialize deviceID={deviceID} />;
        case DeviceStatus.LOGGED_IN:
            return <Seed deviceID={deviceID} />;
        case DeviceStatus.SEEDED:
            return <Settings deviceID={deviceID} />
        }
    }
}
