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

import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { BitBox02 } from '../../components/devices/bitbox02/bitbox02';
import { BitBox02Bootloader } from '../../components/devices/bitbox02bootloader/bitbox02bootloader';
import Device from './device';
import { Waiting } from './waiting';

export interface Devices {
    [deviceID: string]: 'bitbox' | 'bitbox02' | 'bitbox02-bootloader';
}

// Keys are typed as 'string | number' in Preact, which prevents us from using 'Devices' (object) here.
interface Props {
    key?: any;
    devices: Devices;
    deviceID: string | null;
}

class DeviceSwitch extends Component<Props, {}> {
    public componentDidMount() {
        const deviceIDs = Object.keys(this.props.devices);
        if (this.props.deviceID !== null && !deviceIDs.includes(this.props.deviceID)) {
            route('/', true);
        }
        if (this.props.deviceID === null && deviceIDs.length > 0) {
            route(`/device/${deviceIDs[0]}`, true);
        }
    }

    public render({ deviceID, devices }: RenderableProps<Props>) {
        if (this.props.default || deviceID === null || !Object.keys(devices).includes(deviceID)) {
            return <Waiting />;
        }
        switch (devices[deviceID]) {
        case 'bitbox':
            return <Device deviceID={deviceID} />;
        case 'bitbox02':
             return <BitBox02 deviceID={deviceID} />;
        case 'bitbox02-bootloader':
             return <BitBox02Bootloader deviceID={deviceID} />;
        default:
            return <Waiting />;
        }
    }
}

export { DeviceSwitch };
