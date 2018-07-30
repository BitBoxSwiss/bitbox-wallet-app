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
import { apiGet } from '../../utils/request';
import UpgradeFirmware from './settings/components/upgradefirmware';
import { Guide } from '../../components/guide/guide';
import { BitBox } from '../../components/icon/logo';
import style from './device.css';

@translate()
export default class RequireUpgrade extends Component {
    state = {
        firmwareVersion: null
    }

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ version }) => {
            this.setState({
                firmwareVersion: version.replace('v', ''),
            });
        });
    }

    render({ deviceID, guide }, { firmwareVersion }) {
        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <BitBox />
                    <p><strong>A firmware upgrade is required for your BitBox.</strong></p>
                    <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                </div>
                <Guide guide={guide} screen="require_upgrade" />
            </div>
        );
    }
}
