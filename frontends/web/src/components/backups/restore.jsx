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

import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { Button, Checkbox } from '../forms';
import Dialog from '../dialog/dialog';
import WaitDialog from '../wait-dialog/wait-dialog';
import Spinner from '../spinner/Spinner';
import { PasswordRepeatInput } from '../password';
import { apiPost } from '../../utils/request';
import style from './backups.css';

@translate()
export default class Restore extends Component {
    state = {
        password: null,
        isConfirming: false,
        activeDialog: false,
        isLoading: false,
        understand: false,
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        const {
            isConfirming,
            isLoading,
        } = this.state;
        if (e.keyCode === 27 && !isConfirming && !isLoading) {
            this.abort();
        } else {
            return;
        }
    }

    abort = () => {
        this.setState({
            password: null,
            isConfirming: false,
            activeDialog: false,
            understand: false,
        });
        if (this.passwordInput) {
            this.passwordInput.clear();
        }
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    }

    validate = () => {
        return this.props.selectedBackup && this.state.password;
    }

    restore = event => {
        event.preventDefault();
        if (!this.validate()) return;
        if (this.props.requireConfirmation) {
            this.setState({
                activeDialog: false,
                isConfirming: true,
            });
        } else {
            this.setState({
                activeDialog: false,
                isLoading: true,
            });
        }
        apiPost('devices/' + this.props.deviceID + '/backups/restore', {
            password: this.state.password,
            filename: this.props.selectedBackup,
        }).catch(() => {}).then(({ didRestore, errorMessage }) => {
            this.abort();
            if (didRestore) {
                if (this.props.onRestore) {
                    return this.props.onRestore();
                }
                console.log('restore.jsx route to /'); // eslint-disable-line no-console
                route('/', true);
            } else if (errorMessage) {
                alert(errorMessage); // eslint-disable-line no-alert
            }
        });
    }

    handleUnderstandChange = (e) => {
        this.setState({ understand: e.target.checked });
    }

    setValidPassword = password => {
        this.setState({ password });
    }

    render({
        t,
        selectedBackup,
        requireConfirmation,
    }, {
        password,
        isConfirming,
        activeDialog,
        isLoading,
        understand,
    }) {
        return (
            <span>
                <Button
                    danger={requireConfirmation}
                    primary={!requireConfirmation}
                    disabled={selectedBackup === null}
                    onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.restore')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('backup.restore.title')}>
                            <form onSubmit={this.restore}>
                                <PasswordRepeatInput
                                    ref={ref => this.passwordInput = ref}
                                    label={t('backup.restore.password.label')}
                                    placeholder={t('backup.restore.password.placeholder')}
                                    repeatPlaceholder={t('backup.restore.password.repeatPlaceholder')}
                                    showLabel={t('backup.restore.password.showLabel')}
                                    onValidPassword={this.setValidPassword} />
                                <div className={style.agreements}>
                                    <Checkbox
                                        id="funds_access"
                                        label={t('backup.restore.understand')}
                                        checked={understand}
                                        onChange={this.handleUnderstandChange} />
                                </div>
                                <div class={['buttons', 'flex', 'flex-row', 'flex-between'].join(' ')}>
                                    <Button
                                        secondary
                                        onClick={this.abort}
                                        disabled={isConfirming}>
                                        {t('button.back')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        danger={requireConfirmation}
                                        primary={!requireConfirmation}
                                        disabled={!understand || !this.validate() || isConfirming}>
                                        {t('button.restore')}
                                    </Button>
                                </div>
                            </form>
                        </Dialog>
                    )
                }
                {
                    (isConfirming && requireConfirmation) && (
                        <WaitDialog title={t('backup.restore.confirmTitle')} />
                    )
                }
                {
                    isLoading && (
                        <Spinner text={t('backup.restore.restoring')} showLogo />
                    )
                }
            </span>
        );
    }
}
