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
import DeviceInfo from '../../../routes/device/settings/components/deviceinfo';
import RandomNumber from '../../../routes/device/settings/components/randomnumber';
import SetDeviceName from '../../../routes/device/settings/components/setdevicename';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { alertUser } from '../../alert/Alert';
import { Dialog } from '../../dialog/dialog';
import { Button } from '../../forms';

interface State {
    hash?: string;
    deviceVerified: boolean;
    status: 'unpaired' | 'pairingFailed' | 'uninitialized' | 'seeded' | 'initialized' | 'unlocked';
    settingPassword: boolean;
    creatingBackup: boolean;
}

interface Props {
    deviceID: string;
}

class BitBox02 extends Component<Props, {}> {
    public state = {
        hash: undefined,
        deviceVerified: false,
        status: 'unpaired',
        settingPassword: false,
        creatingBackup: false,
    };

    private unsubscribe!: () => void;

    public componentDidMount() {
        this.onChannelHashChanged();
        this.onStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data }) => {
            switch (type) {
                case 'device':
                    switch (data) {
                        case 'channelHashChanged':
                            this.onChannelHashChanged();
                            break;
                        case 'statusChanged':
                            this.onStatusChanged();
                            break;
                    }
                    break;
            }
        });
    }

    private onChannelHashChanged = () => {
        apiGet('devices/bitbox02/' + this.props.deviceID + '/channel-hash').then(({ hash, deviceVerified }) => {
            this.setState({ hash, deviceVerified });
        });
    }

    private onStatusChanged = () => {
        apiGet('devices/bitbox02/' + this.props.deviceID + '/status').then(status => {
            this.setState({ status });
        });
    }

    public componentWillUnmount() {
        this.unsubscribe();
    }

    private channelVerify = ok => {
        apiPost('devices/bitbox02/' + this.props.deviceID + '/channel-hash-verify', ok);
    }

    private setPassword = () => {
        this.setState({ settingPassword: true });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/set-password').then(({ success }) => {
            if (!success) {
                alertUser('pw did not match, try again');
            }
            this.setState({ settingPassword: false });
        });
    }

    private createBackup = () => {
        this.setState({ creatingBackup: true });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/create-backup').then(({ success }) => {
            if (!success) {
                alertUser('creating backup failed, try again');
            }
            this.setState({ creatingBackup: false });
        });
    }

    public render({ deviceID }: RenderableProps<Props>, { hash, deviceVerified, status, settingPassword, creatingBackup }: State) {
        switch (status) {
            case 'unpaired':
                return (
                    <Dialog onClose={() => this.channelVerify(false)}>
                        <p>Verify your BitBox</p>
                        <p>{hash}</p>
                        <Button primary onClick={() => this.channelVerify(true)} disabled={!deviceVerified}>Correct</Button>
                    </Dialog>
                );
            case 'pairingFailed':
                return (
                    <div>
                        Unconfirmed pairing. Please replug your BitBox02.
                    </div>
                );
            case 'uninitialized':
                return (
                    <div>
                        Uninitalized. <Button primary onClick={this.setPassword} disabled={settingPassword}>Create New</Button>
                    </div>
                );
            case 'initialized':
                return (
                    <div>
                        Please enter PW to unlock.
                    </div>
                );
            case 'seeded':
                return (
                    <div>
                        Password set, device seeded. <Button primary onClick={this.createBackup} disabled={creatingBackup}>Create Backup</Button>
                    </div>
                );
            case 'unlocked':
                return (
                    <div>
                        <span>Hello BitBox02</span>
                        <RandomNumber apiPrefix={'devices/bitbox02/' + deviceID} />
                        <DeviceInfo apiPrefix={'devices/bitbox02/' + deviceID} />
                        <SetDeviceName apiPrefix={'devices/bitbox02/' + deviceID} />
                    </div>
                );
        }
    }
}

export { BitBox02 };
