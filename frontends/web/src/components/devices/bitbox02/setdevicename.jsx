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
import { SettingsButton } from '../../settingsButton/settingsButton';
import WaitDialog from '../../wait-dialog/wait-dialog';

@translate()
export class SetDeviceName extends Component {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            deviceName: '',
            inProgress: false,
        };
    }

    setName = () => {
        this.setState({ inProgress: true });
        apiPost(this.props.apiPrefix + '/set-device-name', { name: this.state.deviceName }).then(result => {
            this.setState({ inProgress: false });
            if (result.success) {
                this.abort();
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
            deviceName: '',
        });
    }

    handleChange = e => {
        let value = e.target.value;
        this.setState({ deviceName: value });
    }

    abort = () => {
        this.setState({
            active: false,
        });
    }

    validate = () => {
        // @ts-ignore
        if (!this.nameInput || !this.nameInput.validity.valid || !this.state.deviceName) {
            return false;
        }
        return true;
    }

    render({ t, name }, { deviceName, active, inProgress }) {
        return (
            <div>
                <SettingsButton onClick={this.setNameDialog} optionalText={name}>
                    {t('bitbox02Settings.deviceName.title')}
                </SettingsButton>
                {
                    active ? (
                        <Dialog onClose={this.abort} title={t('bitbox02Settings.deviceName.title')}>
                            <Input
                                pattern="^.{0,63}$"
                                label={t('bitbox02Settings.deviceName.input')}
                                onInput={this.handleChange}
                                getRef={ref => this.nameInput = ref}
                                value={deviceName}
                                id="deviceName" />
                            <div class={[dialogStyles.buttons, 'buttons', 'flex', 'flex-row', 'flex-between'].join(' ')}>
                                <Button
                                    secondary
                                    onClick={this.abort}>
                                    {t('button.back')}
                                </Button>
                                <Button
                                    primary
                                    disabled={!this.validate()}
                                    onClick={this.setName}>
                                    {t('button.ok')}
                                </Button>
                            </div>
                        </Dialog>
                    ) : null
                }
                { inProgress && (
                    <WaitDialog title={t('bitbox02Settings.deviceName.title')} >
                        {t('bitbox02Interact.followInstructions')}
                    </WaitDialog>
                )}
            </div>
        );
    }
}
