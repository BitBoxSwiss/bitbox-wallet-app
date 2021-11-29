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

import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { alertUser } from '../../../components/alert/Alert';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { Button, Checkbox } from '../../../components/forms';
import { PasswordRepeatInput } from '../../../components/password';
import { Spinner } from '../../../components/spinner/Spinner';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';
import * as style from '../components/backups.module.css';

interface RestoreProps {
    selectedBackup?: string;
    requireConfirmation: boolean;
    deviceID: string;
    onRestore: () => void;
}

type Props = RestoreProps & TranslateProps;

interface State {
    isConfirming: boolean;
    activeDialog: boolean;
    isLoading: boolean;
    understand: boolean;
    password?: string;
}

class Restore extends Component<Props, State> {
    public readonly state: State = {
        isConfirming: false,
        activeDialog: false,
        isLoading: false,
        understand: false,
        password: undefined,
    };

    private abort = () => {
        this.setState({
            isConfirming: false,
            activeDialog: false,
            isLoading: false,
            understand: false,
            password: undefined,
        });
    }

    private validate = () => {
        return this.props.selectedBackup && this.state.password;
    }

    private restore = (event: Event) => {
        event.preventDefault();
        if (!this.validate()) { return; }
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
        }).then(data => {
            const { success, didRestore, errorMessage, code } = data;
            this.abort();
            if (success) {
                if (didRestore) {
                    if (this.props.onRestore) {
                        return this.props.onRestore();
                    }
                    console.info('restore.jsx route to /');
                    route('/', true);
                }
            } else {
                alertUser(this.props.t(`backup.restore.error.e${code}`, {
                    defaultValue: errorMessage,
                }));
            }
        });
    }

    private handleUnderstandChange = (e: Event) => {
        this.setState({ understand: (e.target as HTMLInputElement).checked });
    }

    private setValidPassword = (password: string) => {
        this.setState({ password });
    }

    public render(
        {
            t,
            selectedBackup,
            requireConfirmation,
        }: RenderableProps<Props>,
        {
            isConfirming,
            activeDialog,
            isLoading,
            understand,
        }: State) {
        return (
            <span>
                <Button
                    danger={requireConfirmation}
                    primary={!requireConfirmation}
                    disabled={!selectedBackup}
                    onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.restore')}
                </Button>
                {
                    activeDialog && (
                        <Dialog
                            title={t('backup.restore.title')}
                            disableEscape={isConfirming || isLoading}
                            onClose={this.abort}>
                            <form onSubmit={this.restore}>
                                <PasswordRepeatInput
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
                                <DialogButtons>
                                    <Button
                                        type="submit"
                                        danger={requireConfirmation}
                                        primary={!requireConfirmation}
                                        disabled={!understand || !this.validate() || isConfirming}>
                                        {t('button.restore')}
                                    </Button>
                                    <Button
                                        transparent
                                        onClick={this.abort}
                                        disabled={isConfirming}>
                                        {t('button.back')}
                                    </Button>
                                </DialogButtons>
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
                        <Spinner text={t('backup.restore.restoring')} />
                    )
                }
            </span>
        );
    }
}

const TranslatedRestore = translate<RestoreProps>()(Restore);
export { TranslatedRestore as Restore };
