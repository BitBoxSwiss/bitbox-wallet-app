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
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { CenteredContent } from '../../centeredcontent/centeredcontent';
import { Button } from '../../forms';
import { BitBox02 } from '../../icon/logo';
import { ToggleShowFirmwareHash } from './toggleshowfirmwarehash';

interface BitBox02BootloaderProps {
    deviceID: string;
}

interface LoadedProps {
    erased: boolean;
}

type Props = BitBox02BootloaderProps & LoadedProps & TranslateProps;

interface State {
    status: {
        upgrading: boolean;
        errMsg?: string;
        progress: number;
        upgradeSuccessful: boolean;
        rebootSeconds: number;
    };
    advancedSettings: boolean;
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
            advancedSettings: false,
        };
    }

    private unsubscribe!: () => void;

    public componentDidMount() {
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

    private screenRotate = () => {
        apiPost('devices/bitbox02-bootloader/' + this.props.deviceID + '/screen-rotate');
    }

    public render(
        { t,
          deviceID,
          erased,
        }: RenderableProps<Props>,
        { status,
          advancedSettings,
        }: State,
    ) {
        let contents;
        if (status.upgrading) {
            if (status.upgradeSuccessful) {
                contents = (
                    <div className="box large">
                        <p style="margin-bottom: 0;">{t('bb02Bootloader.success', { rebootSeconds: status.rebootSeconds.toString() })}</p>
                    </div>
                );
            } else {
                const value = Math.round(status.progress * 100);
                contents = (
                    <div className="box large">
                        <progress value={value} max="100">{value}%</progress>
                        <p style="margin-bottom: 0;">{t('bootloader.progress', {
                            progress: value.toString(),
                        })}</p>
                    </div>
                );
            }
        } else {
            contents = (
                <div className="box large">
                    <div className="buttons">
                        <Button
                            primary
                            onClick={this.upgradeFirmware}>
                            {t('bootloader.button')}
                        </Button>
                        { !erased && (
                            <Button
                                transparent
                                onClick={this.reboot}>
                                {t('bb02Bootloader.abort')}
                            </Button>
                        )}
                    </div>
                    <div>
                        {t('bb02Bootloader.orientation')}&nbsp;
                        <a
                            onClick={this.screenRotate}
                            style="text-decoration: underline; cursor: pointer;" >
                            {t('bb02Bootloader.flipscreen')}
                        </a>
                    </div>
                    <hr/>
                    <div>
                        <a
                            onClick={() => { this.setState({ advancedSettings: !advancedSettings }); }}
                            style="text-decoration: underline; cursor: pointer;" >
                            { advancedSettings ? '-' : '+' } Advanced Settings
                        </a>
                    </div>
                    { advancedSettings && (
                          <div>
                              <br />
                              <ToggleShowFirmwareHash deviceID={deviceID} />
                          </div>
                    )}
                </div>
            );
        }
        return (
            <CenteredContent>
                <BitBox02 />
                {contents}
                <p className="text-center">{status.errMsg}</p>
            </CenteredContent>
        );
    }
}

const loadHOC = load<LoadedProps, BitBox02BootloaderProps & TranslateProps>(({ deviceID }) => ({ erased: 'devices/bitbox02-bootloader/' + deviceID + '/erased' }))(BitBox02Bootloader);
const HOC = translate<BitBox02BootloaderProps>()(loadHOC);
export { HOC as BitBox02Bootloader };
