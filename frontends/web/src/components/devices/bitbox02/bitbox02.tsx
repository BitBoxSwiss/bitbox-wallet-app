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
import { apiGet } from '../../../utils/request';
import { Dialog } from '../../dialog/dialog';
import { Button } from '../../forms';

interface State {
    hash?: string;
    verified: boolean;
}

interface Props {
    deviceID: string;
}

class BitBox02 extends Component<Props, {}> {
    public state = {
        hash: undefined,
        verified: false,
    };

    private unsubscribe!: () => void;

    public componentDidMount() {
        apiGet('devices/bitbox02/' + this.props.deviceID + '/channel-hash').then(({ hash, verified }) => {
            this.setState({ hash, verified });
        });
    }

    public componentWillUnmount() {
        this.unsubscribe();
    }

    private abort = () => {
        this.setState({ verified: true });
    }

    public render({ deviceID }: RenderableProps<Props>, { hash, verified }: State) {
        return (
            <div>
                <span>Hello BitBox02</span>
                <RandomNumber apiPrefix={'devices/bitbox02/' + deviceID} />
                <DeviceInfo apiPrefix={'devices/bitbox02/' + deviceID} />
                <SetDeviceName apiPrefix={'devices/bitbox02/' + deviceID} />
                {
                    !verified ? (
                        <Dialog onClose={this.abort}>
                            <p>Verify your BitBox</p>
                            <p>{hash}</p>
                            <Button primary onClick={this.abort}>Correct</Button>
                        </Dialog>
                    ) : null
                }
            </div>
        );
    }
}

export { BitBox02 };
