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
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { PasswordRepeatInput } from '../../../../components/password';
import { apiPost } from '../../../../utils/request';
import InnerHTMLHelper from '../../../../utils/innerHTML';


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
        if (this.passwordInput) {
            this.passwordInput.clear();
        }
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
        }).catch(() => {}).then(({ success, didCreate, errorMessage }) => {
            this.abort();
            if (success) {
                if (didCreate) {
                    alert(this.props.t('hiddenWallet.success')); // eslint-disable-line no-alert
                }
            } else {
                alert(errorMessage); // eslint-disable-line no-alert
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
        password,
        isConfirming,
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    primary
                    disabled={disabled}
                    onclick={() => this.setState({ activeDialog: true })}>
                    {t('button.hiddenwallet')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('button.hiddenwallet')}>
                            <InnerHTMLHelper tagName="p" html={t('hiddenWallet.info1HTML')} />
                            <InnerHTMLHelper tagName="p" html={t('hiddenWallet.info2HTML')} />
                            <InnerHTMLHelper tagName="p" html={t('hiddenWallet.info3HTML')} />

                            <form onSubmit={this.createHiddenWallet}>
                                <PasswordRepeatInput
                                    idPrefix="pin"
                                    pattern="^.{4,}$"
                                    title={t('initialize.input.invalid')}
                                    label={t('hiddenWallet.pinLabel')}
                                    repeatLabel={t('hiddenWallet.pinRepeatLabel')}
                                    repeatPlaceholder={t('hiddenWallet.pinRepeatPlaceholder')}
                                    ref={ref => this.pinInput = ref}
                                    onValidPassword={this.setValidPIN} />
                                <PasswordRepeatInput
                                    idPrefix="password"
                                    ref={ref => this.passwordInput = ref}
                                    label={t('hiddenWallet.passwordLabel')}
                                    repeatPlaceholder={t('hiddenWallet.passwordPlaceholder')}
                                    onValidPassword={this.setValidPassword}
                                />
                                <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                    <Button secondary onClick={this.abort} disabled={isConfirming}>
                                        {t('button.abort')}
                                    </Button>
                                    <Button type="submit" danger disabled={!this.validate() || isConfirming}>
                                        {t('button.hiddenwallet')}
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
            </span>
        );
    }
}
