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
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';
import { apiPost } from '../../../../utils/request';

@translate()
export default class Blink extends Component {
    blinkDevice = () => {
        apiPost('devices/' + this.props.deviceID + '/blink');
    };

    render({ t }, {}) {
        return (
            <SettingsButton onClick={this.blinkDevice}>{t('blink.button')}</SettingsButton>
        );
    }
}
