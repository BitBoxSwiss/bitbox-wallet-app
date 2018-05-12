import { Component } from 'preact';
import { translate } from 'react-i18next';

import { apiGet } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import Bootloader from '../device/bootloader';
import Login from '../device/unlock';
import Seed from '../device/seed';
import Initialize from '../device/initialize';
import Settings from '../settings/settings';

const DeviceStatus = Object.freeze({
    BOOTLOADER: 'bootloader',
    INITIALIZED: 'initialized',
    UNINITIALIZED: 'uninitialized',
    LOGGED_IN: 'logged_in',
    SEEDED: 'seeded'
});

@translate()
export default class Device extends Component {
    state = {
        deviceRegistered: false,
        deviceStatus: null,
    }

    componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.unsubscribe = apiWebsocket(({ type, data, deviceID }) => {
            if (type === 'devices' && data === 'registeredChanged') {
                this.onDevicesRegisteredChanged();
            }
            if (type === 'device' && deviceID === this.props.deviceID) {
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
            const deviceRegistered = deviceIDs.includes(this.props.deviceID);
            this.setState({
                deviceRegistered,
                deviceStatus: null
            });
            if (deviceRegistered) {
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

    render({ t, deviceID }, { deviceRegistered, deviceStatus }) {
        if (!deviceRegistered || !deviceStatus) {
            return <h3>{t('device.waiting')}</h3>;
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
            return <Settings deviceID={deviceID} />;
        }
    }
}
