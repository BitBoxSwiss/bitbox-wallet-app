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

import { Component, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { Backup, BackupsListItem } from '../../backups/backup';
import { Dialog } from '../../dialog/dialog';
import * as dialogStyle from '../../dialog/dialog.css';
import { Button } from '../../forms';

interface CheckProps {
    deviceID: string;
    backups: Backup[];
    disabled: boolean;
}

type Props = CheckProps & TranslateProps;

interface State {
    activeDialog: boolean;
    message: string;
    foundBackup?: Backup;
    userVerified: boolean;
}

class Check extends Component<Props, State> {
    public state = {
        activeDialog: false,
        message: '',
        foundBackup: undefined,
        userVerified: false,
    };

    private checkBackup = (silent: boolean, backups) => {
        apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/check', {
            silent,
        }).then( response => {
            let message;
            // "silent" call gets the backup id from device without blocking to display in dialogue
            if (silent && response.success && response.backupID) {
                const foundBackup = backups.find((backup: Backup) => backup.id === response.backupID);
                if (foundBackup) {
                    this.setState({ foundBackup });
                    message = this.props.t('backup.check.success');
                } else {
                    message = this.props.t('unknownError', {errorMessage: 'Not found'});
                }
            // second non-silent call is blocking and waits for user to confirm backup on device screen
            } else if (!silent && response.success) {
                message = this.props.t('backup.check.success');
                this.setState({ userVerified: true });
            } else {
                message = this.props.t('backup.check.notOK');
                this.setState({ userVerified: true });
            }
            this.setState({ message });
        });
    }

    private abort = () => {
        this.setState({ activeDialog: false, userVerified: false });
    }

    public render({ t, backups }: RenderableProps<Props>, { activeDialog, message, foundBackup, userVerified }: State) {
        let silent: boolean;
        return (
            <div>
                <Button
                    secondary
                    disabled={this.props.disabled}
                    onClick={() => {
                        this.checkBackup(silent = true, backups = backups);
                        this.setState({ activeDialog: true, userVerified: false });
                        this.checkBackup(silent = false, backups = backups);
                    }}
                >
                    {t('button.check')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={message}>
                            {
                                <div className="columnsContainer half">
                                    <div className="columns">
                                        <div className="column">
                                            {
                                                foundBackup !== undefined && (
                                                    <BackupsListItem
                                                        backup={foundBackup}
                                                        handleChange={() => undefined}
                                                        onFocus={() => undefined}
                                                        radio={false} />
                                                )
                                            }
                                        </div>
                                    </div>
                                    <div className={dialogStyle.actions}>
                                        <Button
                                            primary
                                            onClick={this.abort}
                                            disabled={!userVerified}
                                        >
                                            { userVerified ? t('button.ok') : t('accountInfo.verify') }
                                        </Button>
                                    </div>
                                </div>
                            }
                        </Dialog>
                    )
                }
            </div>
        );
    }
}

const HOC = translate<CheckProps>()(Check);
export { HOC as Check };
