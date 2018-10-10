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
import { Button, Input } from '../forms';
import { PasswordInput } from '../password';
import { apiPost } from '../../utils/request';
import Dialog from '../dialog/dialog';

@translate()
export default class Create extends Component {
    state = {
        waiting: false,
        backupName: '',
        recoveryPassword: '',
        activeDialog: false,
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        if (e.keyCode === 27) {
            this.abort();
        }
    }

    abort = () => {
        this.setState({
            waiting: false,
            backupName: '',
            recoveryPassword: '',
            activeDialog: false,
        });
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    validate = () => {
        return !this.state.waiting && this.state.backupName !== '';
    }

    create = event => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({ waiting: true });
        apiPost('devices/' + this.props.deviceID + '/backups/create', {
            backupName: this.state.backupName,
            recoveryPassword: this.state.recoveryPassword,
        }).then(data => {
            this.abort();
            if (!data.success) {
                alert(data.errorMessage); // eslint-disable-line no-alert
            } else {
                this.props.onCreate();
                if (!data.verification) {
                    alert(this.props.t('backup.create.verificationFailed'));
                }
            }
        });
    }

    render({ t }, {
        waiting,
        recoveryPassword,
        backupName,
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    primary
                    onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.create')}
                </Button>
                {
                    activeDialog && (
                        <Dialog
                            title={t('backup.create.title')}
                            onClose={this.abort}>
                            <form onSubmit={this.create}>
                                <Input
                                    autoFocus
                                    autoComplete="off"
                                    id="backupName"
                                    label={t('backup.create.name.label')}
                                    placeholder={t('backup.create.name.placeholder')}
                                    onInput={this.handleFormChange}
                                    value={backupName} />
                                <p>{t('backup.create.info')}</p>
                                <PasswordInput
                                    id="recoveryPassword"
                                    label={t('backup.create.password.label')}
                                    placeholder={t('backup.create.password.placeholder')}
                                    onInput={this.handleFormChange}
                                    value={recoveryPassword} />
                                <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                    <Button secondary onClick={this.abort}>
                                        {t('button.abort')}
                                    </Button>
                                    <Button type="submit" primary disabled={waiting || !this.validate()}>
                                        {t('button.create')}
                                    </Button>
                                </div>
                            </form>
                        </Dialog>
                    )
                }
            </span>
        );
    }
}
