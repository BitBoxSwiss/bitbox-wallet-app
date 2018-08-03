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
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { BitBox } from '../../../components/icon/logo';
import { Button } from '../../../components/forms';
import style from '../device.css';

@translate()
export default class Bootloader extends Component {
    constructor(props) {
        super(props);
        this.state = {
            upgrading: false,
            errMsg: null,
            progress: 0,
            upgradeSuccessful: false
        };
    }

    componentDidMount() {
        this.unsubscribe = apiWebsocket(this.onEvent);
        this.onStatusChanged();
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    onEvent = data => {
        if (data.type !== 'device') {
            return;
        }
        switch (data.data) {
        case 'bootloaderStatusChanged':
            this.onStatusChanged();
            break;
        }
    }

    onStatusChanged = () => {
        apiGet('devices/' + this.props.deviceID + '/bootloader-status')
            .then(({ upgrading, progress, upgradeSuccessful, errMsg }) => {
                this.setState({
                    upgrading,
                    progress,
                    upgradeSuccessful,
                    errMsg,
                });
            });
    }

    upgradeFirmware = () => {
        apiPost('devices/' + this.props.deviceID + '/bootloader/upgrade-firmware');
    }

    render({
        t
    }, {
        upgrading,
        progress,
        upgradeSuccessful,
        errMsg,
    }) {
        let UpgradeOrStatus;

        if (upgrading) {
            if (upgradeSuccessful) {
                UpgradeOrStatus = <p>{t('bootloader.success')}</p>;
            } else {
                const value = Math.round(progress * 100);
                UpgradeOrStatus = (
                    <div>
                        <progress value={value} max="100">{value}%</progress>
                        <p>{t('bootloader.progress', {
                            progress: value
                        })}</p>
                    </div>
                );
            }
        } else {
            UpgradeOrStatus = (
                <Button
                    primary
                    onClick={this.upgradeFirmware}>
                    {t('bootloader.button')}
                </Button>
            );
        }
        return (
            <div class="content">
                <div className={[style.container, style.scrollable].join(' ')}>
                    <BitBox />
                    <div style="margin: 1rem; min-height: 5rem;">
                        {UpgradeOrStatus}
                        <p>{ errMsg }</p>
                    </div>
                </div>
            </div>
        );
    }
}
