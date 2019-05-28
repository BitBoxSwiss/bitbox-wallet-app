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
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { CenteredContent } from '../../centeredcontent/centeredcontent';
import { Button } from '../../forms';
import { BitBox } from '../../icon/logo';

interface BitBox02BootloaderProps {
    deviceID: string;
}

type Props = BitBox02BootloaderProps & TranslateProps;

interface State {
    status: {
        upgrading: boolean;
        errMsg?: string;
        progress: number;
        upgradeSuccessful: boolean;
        rebootSeconds: number;
    };
    erased: boolean;
}

class BitBox02Bootloader extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            status: {
                upgrading: false,
                errMsg: undefined,
                progress: 0,
                upgradeSuccessful: false,
                rebootSeconds: 0,
            },
            erased: false,
        };
    }

    private unsubscribe!: () => void;

    public componentDidMount() {
        apiGet('devices/bitbox02-bootloader/' + this.props.deviceID + '/erased').then(erased => {
            this.setState({ erased });
        });
        this.onStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data, deviceID }) => {
            switch (type) {
                case 'device':
                    if (deviceID !== this.props.deviceID) {
                        return;
                    }
                    switch (data) {
                        case 'statusChanged':
                            this.onStatusChanged();
                            break;
                    }
                    break;
            }
        });
    }

    public componentWillUnmount() {
        this.unsubscribe();
    }

    private onStatusChanged = () => {
        apiGet('devices/bitbox02-bootloader/' + this.props.deviceID + '/status').then(status => {
            this.setState({ status });
        });
    }

    private upgradeFirmware = () => {
        apiPost('devices/bitbox02-bootloader/' + this.props.deviceID + '/upgrade-firmware');
    }

    private reboot = () => {
        apiPost('devices/bitbox02-bootloader/' + this.props.deviceID + '/reboot');
    }

    public render(
        { t }: RenderableProps<Props>,
        { status,
          erased }: State,
    ) {
        let upgradeOrStatus;
        if (status.upgrading) {
            if (status.upgradeSuccessful) {
                upgradeOrStatus = <p>{t('bb02Bootloader.success', { rebootSeconds: status.rebootSeconds.toString() })}</p>;
            } else {
                const value = Math.round(status.progress * 100);
                upgradeOrStatus = (
                    <div>
                        <progress value={value} max="100">{value}%</progress>
                        <p>{t('bootloader.progress', {
                            progress: value.toString(),
                        })}</p>
                    </div>
                );
            }
        } else {
            upgradeOrStatus = (
                <div style="text-align:center;">
                    <Button
                        primary
                        onClick={this.upgradeFirmware}>
                        {t('bootloader.button')}
                    </Button>
                    <br/><br/>
                    { !erased && (
                          <Button
                              secondary
                              onClick={this.reboot}>
                              {t('bb02Bootloader.abort')}
                          </Button>
                    )}
                </div>
            );
        }
        return (
            <CenteredContent>
                <BitBox />
                <div style="margin: 1rem; min-height: 5rem;">
                    {upgradeOrStatus}
                    <p>{status.errMsg}</p>
                </div>
            </CenteredContent>
        );
    }
}

const HOC = translate<BitBox02BootloaderProps>()(BitBox02Bootloader);
export { HOC as BitBox02Bootloader };
