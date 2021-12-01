/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import { Button, Input } from '../../../components/forms';
import { apiPost } from '../../../utils/request';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { alertUser } from '../../../components/alert/Alert';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';

class SetDeviceNameClass extends Component {
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

    render() {
        const { t, name } = this.props;
        const { deviceName, active, inProgress } = this.state;
        return (
            <div>
                <SettingsButton onClick={this.setNameDialog} optionalText={name}>
                    {t('bitbox02Settings.deviceName.title')}
                </SettingsButton>
                {
                    active ? (
                        <Dialog onClose={this.abort} title={t('bitbox02Settings.deviceName.title')} small>
                            <div className="columnsContainer half">
                                <div className="columns half">
                                    <div className="column">
                                        <label>{t('bitbox02Settings.deviceName.current')}</label>
                                        <p className="m-bottom-half">{name}</p>
                                    </div>
                                    <div className="column">
                                        <Input
                                            pattern="^.{0,63}$"
                                            label={t('bitbox02Settings.deviceName.input')}
                                            onInput={this.handleChange}
                                            getRef={ref => this.nameInput = ref}
                                            placeholder={t('bitbox02Settings.deviceName.placeholder')}
                                            value={deviceName}
                                            id="deviceName" />
                                    </div>
                                </div>
                            </div>
                            <DialogButtons>
                                <Button
                                    primary
                                    disabled={!this.validate()}
                                    onClick={this.setName}>
                                    {t('button.ok')}
                                </Button>
                            </DialogButtons>
                        </Dialog>
                    ) : null
                }
                { inProgress && (
                    <WaitDialog>
                        {t('bitbox02Interact.followInstructions')}
                    </WaitDialog>
                )}
            </div>
        );
    }
}

export const SetDeviceName = translate()(SetDeviceNameClass);
