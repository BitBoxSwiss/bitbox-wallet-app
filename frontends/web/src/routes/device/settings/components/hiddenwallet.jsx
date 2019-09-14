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
import { PasswordRepeatInput } from '../../../../components/password';
import { apiPost } from '../../../../utils/request';
import SimpleMarkup from '../../../../utils/simplemarkup';
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';
import * as dialogStyle from '../../../../components/dialog/dialog.css';


@translate()
export default class HiddenWallet extends Component {
    state = {
        password: null,
        pin: null,
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
            password: null,
            isConfirming: false,
            activeDialog: false,
        });
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    }

    validate = () => {
        return this.state.password && this.state.pin;
    }

    createHiddenWallet = event => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/set-hidden-password', {
            pin: this.state.pin,
            backupPassword: this.state.password,
        }).catch(() => {}).then(({ success, didCreate, errorMessage, code }) => {
            this.abort();
            if (success) {
                if (didCreate) {
                    alertUser(this.props.t('hiddenWallet.success'));
                }
            } else {
                alertUser(this.props.t(`bitbox.error.e${code}`, {
                    defaultValue: errorMessage
                }));
            }
        });
    }

    setValidPassword = password => {
        this.setState({ password });
    }

    setValidPIN = pin => {
        this.setState({ pin });
    }

    render({
        t,
        disabled,
    }, {
        isConfirming,
        activeDialog,
    }) {
        return (
            <div>
                <SettingsButton
                    disabled={disabled}
                    onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.hiddenwallet')}
                </SettingsButton>
                {
                    activeDialog && (
                        <Dialog title={t('button.hiddenwallet')}
                            onClose={this.abort}>
                            <SimpleMarkup tagName="p" markup={t('hiddenWallet.info1HTML')} />
                            <SimpleMarkup tagName="p" markup={t('hiddenWallet.info2HTML')} />
                            <form onSubmit={this.createHiddenWallet}>
                                <PasswordRepeatInput
                                    idPrefix="pin"
                                    pattern="^.{4,}$"
                                    label={t('hiddenWallet.pinLabel')}
                                    repeatLabel={t('hiddenWallet.pinRepeatLabel')}
                                    repeatPlaceholder={t('hiddenWallet.pinRepeatPlaceholder')}
                                    onValidPassword={this.setValidPIN} />
                                <PasswordRepeatInput
                                    idPrefix="password"
                                    label={t('hiddenWallet.passwordLabel')}
                                    repeatPlaceholder={t('hiddenWallet.passwordPlaceholder')}
                                    onValidPassword={this.setValidPassword}
                                />
                                <div class={dialogStyle.actions}>
                                    <Button type="submit" danger disabled={!this.validate() || isConfirming}>
                                        {t('button.hiddenwallet')}
                                    </Button>
                                    <Button transparent onClick={this.abort} disabled={isConfirming}>
                                        {t('button.abort')}
                                    </Button>
                                </div>
                            </form>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog title={t('button.hiddenwallet')} />
                    )
                }
            </div>
        );
    }
}
