import { Component } from 'preact';
import { route } from 'preact-router';
import { apiGet } from '../../utils/request';
import { debug } from '../../utils/env';
import { apiWebsocket } from '../../utils/websocket';
import Waiting from './waiting';
import Bootloader from './bootloader';
import Unlock from './unlock';
import Seed from './seed';
import Initialize from './initialize';
import RequireUpgrade from './require_upgrade';
import Settings from './settings/settings';

const DeviceStatus = Object.freeze({
    BOOTLOADER: 'bootloader',
    INITIALIZED: 'initialized',
    UNINITIALIZED: 'uninitialized',
    LOGGED_IN: 'logged_in',
    SEEDED: 'seeded',
    REQUIRE_UPGRADE: 'require_upgrade'
});

export default class Device extends Component {
    state = {
        firmwareVersion: null,
        deviceRegistered: false,
        deviceStatus: null,
        walletInitialized: null,
        testing: false,
    }

    componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.onDeviceStatusChanged();
        this.onWalletStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data, deviceID }) => {
            if (type === 'backend' && data === 'walletStatusChanged') {
                this.onWalletStatusChanged();
            }
            if (type === 'devices' && data === 'registeredChanged') {
                this.onDevicesRegisteredChanged();
            }
            if (type === 'device' && data === 'statusChanged' && deviceID === this.getDeviceID()) {
                this.onDeviceStatusChanged();
            }
        });

        if (debug) {
            apiGet('testing').then(testing => this.setState({ testing }));
        }
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.deviceID !== prevProps.deviceID) {
            this.onDevicesRegisteredChanged();
        }
    }

    onWalletStatusChanged = () => {
        apiGet('wallet-status').then(status => {
            if (status === 'initialized' && this.props.default) {
                route('/account', true);
            }
            this.setState({
                walletInitialized: status === 'initialized'
            });
        });
    }

    onDevicesRegisteredChanged = () => {
        apiGet('devices/registered').then(deviceIDs => {
            const deviceRegistered = deviceIDs.includes(this.getDeviceID());

            if (this.props.default && deviceIDs.length === 1) {
                console.log('device.jsx route to', '/device/' + deviceIDs[0]); // eslint-disable-line no-console
                route('/device/' + deviceIDs[0], true);
            }
            this.setState({
                deviceRegistered,
                deviceStatus: null
            });
            // only if deviceRegistered or softwarekeystore
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

    getDeviceID() {
        return this.props.deviceID || this.props.deviceIDs[0] || null;
    }

    render({
        deviceID,
        deviceIDs,
        guide,
    }, {
        deviceRegistered,
        deviceStatus,
        walletInitialized,
        testing,
    }) {
        if (!deviceIDs.length && !walletInitialized) {
            return <Waiting testing={testing} guide={guide} />;
        }
        if (!deviceRegistered || !deviceStatus) {
            return null; //<h3>waiting</h3>;
        }
        switch (deviceStatus) {
        case DeviceStatus.BOOTLOADER:
            return <Bootloader deviceID={deviceID} guide={guide} />;
        case DeviceStatus.REQUIRE_UPGRADE:
            return <RequireUpgrade deviceID={deviceID} guide={guide} />;
        case DeviceStatus.INITIALIZED:
            return <Unlock deviceID={deviceID} guide={guide} />;
        case DeviceStatus.UNINITIALIZED:
            return <Initialize deviceID={deviceID} guide={guide} />;
        case DeviceStatus.LOGGED_IN:
            return <Seed deviceID={deviceID} guide={guide} />;
        case DeviceStatus.SEEDED:
            return <Settings deviceID={deviceID} guide={guide} />;
        }
    }
}
