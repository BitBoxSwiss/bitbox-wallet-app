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
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { Button, Checkbox } from '../../../../components/forms';
import { Dialog } from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { PasswordInput } from '../../../../components/password';
import { apiPost } from '../../../../utils/request';
import { alertUser } from '../../../../components/alert/Alert';
import * as style from '../../device.css';
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';

@translate()
export default class Reset extends Component {
    state = {
        pin: null,
        isConfirming: false,
        activeDialog: false,
        understand: false,
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

    handleUnderstandChange = (e) => {
        this.setState({ understand: e.target.checked });
    }

    resetDevice = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/reset', { pin: this.state.pin }).then(data => {
            this.abort();
            if (data.success) {
                if (data.didReset) {
                    route('/', true);
                }
            } else if (data.errorMessage) {
                alertUser(this.props.t(`bitbox.error.e${data.code}`, {
                    defaultValue: data.errorMessage,
                }));
            }
        });
    };

    setValidPIN = e => {
        this.setState({ pin: e.target.value });
    }

    abort = () => {
        this.setState({
            pin: null,
            understand: false,
            isConfirming: false,
            activeDialog: false,
        });
    }

    render({
        t
    }, {
        isConfirming,
        activeDialog,
        understand,
        pin,
    }) {
        return (
            <div>
                <SettingsButton danger onClick={() => this.setState({ activeDialog: true })}>
                    {t('reset.button')}
                </SettingsButton>
                {
                    activeDialog && (
                        <Dialog
                            title={t('reset.title')}
                            onClose={this.abort}>
                            <p>
                                {t('reset.description')}
                            </p>
                            <PasswordInput
                                idPrefix="pin"
                                label={t('initialize.input.label')}
                                value={pin}
                                onInput={this.setValidPIN} />
                            <div className={style.agreements}>
                                <Checkbox
                                    id="funds_access"
                                    label={t('reset.understand')}
                                    checked={understand}
                                    onChange={this.handleUnderstandChange} />
                            </div>
                            <div className={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                                <Button secondary onClick={this.abort} disabled={isConfirming}>
                                    {t('button.back')}
                                </Button>
                                <Button danger disabled={!pin || !understand} onClick={this.resetDevice}>
                                    {t('reset.button')}
                                </Button>
                            </div>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog
                            active={isConfirming}
                            title={t('reset.title')}
                        />
                    )
                }
            </div>
        );
    }
}
