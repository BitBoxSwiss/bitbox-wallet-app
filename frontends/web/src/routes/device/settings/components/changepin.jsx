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
import { Button } from '../../../../components/forms';
import { alertUser } from '../../../../components/alert/Alert';
import { Dialog } from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { PasswordInput, PasswordRepeatInput } from '../../../../components/password';
import { apiPost } from '../../../../utils/request';
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';
import * as dialogStyle from '../../../../components/dialog/dialog.css';


@translate()
export default class ChangePIN extends Component {
    state = {
        oldPIN: null,
        newPIN: null,
        errorCode: null,
        isConfirming: false,
        activeDialog: false,
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        if (e.keyCode === 27 && !this.state.isConfirming) {
            this.abort();
        }
    }

    abort = () => {
        this.setState({
            oldPIN: null,
            newPIN: null,
            isConfirming: false,
            activeDialog: false,
        });
    }

    validate = () => {
        return this.state.newPIN && this.state.oldPIN;
    }

    changePin = event => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/change-password', {
            oldPIN: this.state.oldPIN,
            newPIN: this.state.newPIN,
        }).catch(() => {}).then(data => {
            this.abort();
            if (!data.success) {
                alertUser(this.props.t(`bitbox.error.e${data.code}`, {
                    defaultValue: data.errorMessage,
                }));
            }
        });
    }

    setValidOldPIN = e => {
        this.setState({ oldPIN: e.target.value });
    }

    setValidNewPIN = newPIN => {
        this.setState({ newPIN });
    }

    render({
        t,
        disabled,
    }, {
        oldPIN,
        isConfirming,
        activeDialog,
    }) {
        return (
            <div>
                <SettingsButton
                    disabled={disabled}
                    onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.changepin')}
                </SettingsButton>
                {
                    activeDialog && (
                        <Dialog
                            title={t('button.changepin')}
                            onClose={this.abort}>
                            <form onSubmit={this.changePin}>
                                <PasswordInput
                                    idPrefix="oldPIN"
                                    label={t('changePin.oldLabel')}
                                    value={oldPIN}
                                    onInput={this.setValidOldPIN} />
                                {t('changePin.newTitle') && <h4>{t('changePin.newTitle')}</h4>}
                                <PasswordRepeatInput
                                    idPrefix="newPIN"
                                    pattern="^.{4,}$"
                                    label={t('initialize.input.label')}
                                    repeatLabel={t('initialize.input.labelRepeat')}
                                    repeatPlaceholder={t('initialize.input.placeholderRepeat')}
                                    onValidPassword={this.setValidNewPIN} />
                                <div className={dialogStyle.actions}>
                                    <Button type="submit" danger disabled={!this.validate() || isConfirming}>
                                        {t('button.changepin')}
                                    </Button>
                                    <Button transparent onClick={this.abort} disabled={isConfirming}>
                                        {t('button.back')}
                                    </Button>
                                </div>
                            </form>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog title={t('button.changepin')} />
                    )
                }
            </div>
        );
    }
}
