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
import { Button } from '../../forms';
import { apiGet } from '../../../utils/request';
import { Dialog } from '../../dialog/dialog';
import { CopyableInput } from '../../copy/Copy';
import * as dialogStyles from '../../dialog/dialog.css';
import * as style from './deviceinfo.css';


@translate()
export default class DeviceInfo extends Component {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            deviceInfo: undefined,
        };
    }

    getDeviceInfo = () => {
        apiGet(this.props.apiPrefix + '/info').then(deviceInfo => {
            this.setState({
                active: true,
                deviceInfo,
            });
        });
    }

    abort = () => {
        this.setState({
            active: false,
            deviceInfo: undefined,
        });
    }

    render({ t }, { deviceInfo, active }) {
        return (
            <div>
                <Button primary onClick={this.getDeviceInfo}>
                    Get Info
                </Button>
                {
                    active ? (
                        <Dialog onClose={this.abort} title={t('deviceinfo.description')}>
                            <div>
                                <label className={style.label}>Device Name</label>
                                <CopyableInput value={deviceInfo.name} />
                            </div>
                            <div>
                                <label className={style.label}>Firmware Version</label>
                                <CopyableInput value={deviceInfo.version} />
                            </div>
                            <div>
                                <label className={style.label}>Device Initialized Status</label>
                                <CopyableInput value={deviceInfo.initialized} />
                            </div>
                            <div class={[dialogStyles.buttons, "flex flex-row flex-end flex-items-center"].join(' ')}>
                                <Button primary onClick={this.abort}>{t('button.ok')}</Button>
                            </div>
                        </Dialog>
                    ) : null
                }
            </div>
        );
    }
}
