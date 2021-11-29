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
import { apiGet } from '../../../../utils/request';
import UpgradeFirmware from '../components/upgradefirmware';
import { BitBox } from '../../../../components/icon/logo';
import * as style from '../bitbox01.module.css';

class RequireUpgrade extends Component {
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

    render({ t, deviceID }, { firmwareVersion }) {
        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <BitBox />
                    <div className="box">
                        <p className="m-top-none">{t('upgradeFirmware.label')}</p>
                        <div className="buttons m-top-half">
                            <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} asButton />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default translate()(RequireUpgrade);
