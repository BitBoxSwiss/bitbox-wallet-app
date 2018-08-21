/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import { debug } from '../../utils/env';
import { apiWebsocket } from '../../utils/websocket';
import Waiting from './waiting';
import Unlock from './unlock';
import Bootloader from './upgrade/bootloader';
import RequireUpgrade from './upgrade/require_upgrade';
import Goal from './setup/goal';
import SeedCreateNew from './setup/seed-create-new';
import SeedRestore from './setup/seed-restore';
import Initialize from './setup/initialize';
import Settings from './settings/settings';
import A from '../../components/anchor/anchor';

import style from './device.css';

const DeviceStatus = Object.freeze({
    BOOTLOADER: 'bootloader',
    INITIALIZED: 'initialized',
    UNINITIALIZED: 'uninitialized',
    LOGGED_IN: 'logged_in',
    SEEDED: 'seeded',
    REQUIRE_FIRMWARE_UPGRADE: 'require_firmware_upgrade',
    REQUIRE_APP_UPGRADE: 'require_app_upgrade'
});

const GOAL = Object.freeze({
    CREATE: 'create',
    RESTORE: 'restore'
});

@translate()
export default class Device extends Component {
    state = {
        firmwareVersion: null,
        deviceRegistered: false,
        deviceStatus: null,
        accountsStatus: null,
        testing: false,
        goal: null,
    }

    componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.onDeviceStatusChanged();
        this.onAccountsStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data, deviceID }) => {
            if (type === 'backend' && data === 'accountsStatusChanged') {
                this.onAccountsStatusChanged();
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

    onAccountsStatusChanged = () => {
        apiGet('accounts-status').then(status => {
            if (status === 'initialized' && this.props.default) {
                console.log('device.jsx route to /account'); // eslint-disable-line no-console
                route('/account', true);
            }
            this.setState({
                accountsStatus: status === 'initialized'
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

    handleCreate = () => {
        this.setState({ goal: GOAL.CREATE });
    }

    handleRestore = () => {
        this.setState({ goal: GOAL.RESTORE });
    }

    handleBack = () => {
        this.setState({ goal: null });
    }

    render({
        t,
        deviceID,
        deviceIDs,
        guide,
    }, {
        deviceRegistered,
        deviceStatus,
        accountsStatus,
        goal,
        testing,
    }) {
        if (!deviceIDs.length && !accountsStatus) {
            return <Waiting testing={testing} guide={guide} />;
        }
        if (!deviceRegistered || !deviceStatus) {
            return null; //<h3>waiting</h3>;
        }
        console.log(deviceStatus);
        switch (deviceStatus) {
        case DeviceStatus.BOOTLOADER:
            return <Bootloader deviceID={deviceID} guide={guide} />;
        case DeviceStatus.REQUIRE_FIRMWARE_UPGRADE:
            return <RequireUpgrade deviceID={deviceID} guide={guide} />;
        case DeviceStatus.REQUIRE_APP_UPGRADE:
            return (
                <div class="contentWithGuide">
                    <div className={style.container}>
                        {t('device.appUpradeRequired')}
                        <A href="https://shiftcrypto.ch/start">
                            {t('button.download')}
                        </A>
                    </div>
                </div>
            );
        case DeviceStatus.INITIALIZED:
            return <Unlock deviceID={deviceID} guide={guide} />;
        case DeviceStatus.UNINITIALIZED:
            if (!goal) {
                return <Goal onCreate={this.handleCreate} onRestore={this.handleRestore} guide={guide} />;
        }
                return <Initialize goal={goal} goBack={this.handleBack} deviceID={deviceID} guide={guide} />;
        case DeviceStatus.LOGGED_IN:
            switch (goal) {
            case GOAL.CREATE:
                return <SeedCreateNew goBack={this.handleBack} deviceID={deviceID} guide={guide} />;
            case GOAL.RESTORE:
                return <SeedRestore goBack={this.handleBack} deviceID={deviceID} guide={guide} />;
            default:
                return <Goal onCreate={this.handleCreate} onRestore={this.handleRestore} guide={guide} />;
            }
        case DeviceStatus.SEEDED:
            return <Settings deviceID={deviceID} guide={guide} />;
        }
    }
}
