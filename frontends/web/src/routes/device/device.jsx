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

import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { AppUpgradeRequired } from '../../components/appupgraderequired';
import { apiGet } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import Unlock from './unlock';
import Bootloader from './upgrade/bootloader';
import RequireUpgrade from './upgrade/require_upgrade';
import Goal from './setup/goal';
import { SecurityInformation } from './setup/security-information';
import SeedCreateNew from './setup/seed-create-new';
import SeedRestore from './setup/seed-restore';
import { Initialize } from './setup/initialize';
import Success from './setup/success';
import Settings from './settings/settings';
import { store as panelStore } from '../../components/guide/guide';

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
        goal: null,
        success: null,
    }

    componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.onDeviceStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data, deviceID }) => {
            if (type === 'devices' && data === 'registeredChanged') {
                this.onDevicesRegisteredChanged();
            }
            if (type === 'device' && data === 'statusChanged' && deviceID === this.getDeviceID()) {
                this.onDeviceStatusChanged();
            }
        });
    }

    componentWillUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.deviceID !== prevProps.deviceID) {
            this.onDevicesRegisteredChanged();
        }
    }

    onDevicesRegisteredChanged = () => {
        apiGet('devices/registered').then(devices => {
            const deviceIDs = Object.keys(devices);
            const deviceRegistered = deviceIDs.includes(this.getDeviceID());

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
                if (deviceStatus === 'seeded') {
                    panelStore.setState({ forceHiddenSidebar: false });
                }
            });
        }
    }

    getDeviceID() {
        return this.props.deviceID || null;
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

    handleSuccess = () => {
        this.setState({ success: true });
    }

    render({
        deviceID,
    }, {
        deviceRegistered,
        deviceStatus,
        goal,
        success,
    }) {
        if (!deviceRegistered || !deviceStatus) {
            return null;
        }
        if (success) {
            return <Success goal={goal} handleHideSuccess={() => this.setState({ success: null })} />;
        }
        switch (deviceStatus) {
        case DeviceStatus.BOOTLOADER:
            return <Bootloader deviceID={deviceID} />;
        case DeviceStatus.REQUIRE_FIRMWARE_UPGRADE:
            return <RequireUpgrade deviceID={deviceID} />;
        case DeviceStatus.REQUIRE_APP_UPGRADE:
            return <AppUpgradeRequired />;
        case DeviceStatus.INITIALIZED:
            return <Unlock deviceID={deviceID} />;
        case DeviceStatus.UNINITIALIZED:
            if (!goal) {
                return <Goal onCreate={this.handleCreate} onRestore={this.handleRestore} />;
            }
            return (
                <SecurityInformation goal={goal} goBack={this.handleBack}>
                    <Initialize goal={goal} goBack={this.handleBack} deviceID={deviceID} />
                </SecurityInformation>
            );
        case DeviceStatus.LOGGED_IN:
            switch (goal) {
            case GOAL.CREATE:
                return (
                    <SeedCreateNew
                        goBack={this.handleBack}
                        onSuccess={this.handleSuccess}
                        deviceID={deviceID}
                    />
                );
            case GOAL.RESTORE:
                return (
                    <SeedRestore
                        goBack={this.handleBack}
                        onSuccess={this.handleSuccess}
                        deviceID={deviceID}
                    />
                );
            default:
                return <Goal onCreate={this.handleCreate} onRestore={this.handleRestore} />;
            }
        case DeviceStatus.SEEDED:
            return <Settings deviceID={deviceID} />;
        default:
            return null;
        }
    }
}
