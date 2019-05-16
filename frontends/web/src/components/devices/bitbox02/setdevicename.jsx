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
import { Button, Input } from '../../forms';
import { apiPost } from '../../../utils/request';
import { Dialog } from '../../dialog/dialog';
import { alertUser } from '../../alert/Alert';
import * as dialogStyles from '../../dialog/dialog.css';

@translate()
export default class SetDeviceName extends Component {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            deviceName: '',
        };
    }

    setName = () => {
        apiPost(this.props.apiPrefix + '/set-device-name', { name: this.state.deviceName }).then(result => {
            if (result.success) {
                this.setState({
                    active: false,
                });
                this.props.getInfo();
            } else {
                // @ts-ignore
                alertUser('Device name could not be set');
            }
        });
    }

    setNameDialog = () => {
        this.setState({
            active: true,
        });
    }

    handleChange = e => {
        let value = e.target.value;
        this.setState({ deviceName: value });
    }

    abort = () => {
        this.setState({
            active: false,
            deviceName: '',
        });
    }

    render({ t }, { deviceName, active }) {
        return (
            <div>
                <Button primary onClick={this.setNameDialog}>
                    Set Device Name
                </Button>
                {
                    active ? (
                        <Dialog onClose={this.abort} title={t('deviceinfo.set-name')}>
                            <Input
                                label={t('deviceinfo.set-name')}
                                onInput={this.handleChange}
                                value={deviceName}
                                id="deviceName" />
                            <div class={[dialogStyles.buttons, "flex flex-row flex-end flex-items-center"].join(' ')}>
                                <Button primary onClick={this.setName}>{t('button.ok')}</Button>
                            </div>
                        </Dialog>
                    ) : null
                }
            </div>
        );
    }
}
