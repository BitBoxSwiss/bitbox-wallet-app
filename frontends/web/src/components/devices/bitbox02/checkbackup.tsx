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
}

class Check extends Component<Props, State> {
    public state = {
        activeDialog: false,
        message: '',
        foundBackup: undefined,
    };

    private checkBackup = backups => {
        apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/check', {
            silent: false,
        }).then(({ backupID, success }) => {
            let message;
            if (success && backupID) {
                this.setState({foundBackup: backups.find(backup => backup.id === backupID)});
                message = this.props.t('backup.check.success');
            } else {
                message = this.props.t('backup.check.notOK');
            }
            this.setState({ message });
        });
    }

    private abort = () => {
        this.setState({ activeDialog: false });
    }

    public render({ t, backups }: RenderableProps<Props>, { activeDialog, message, foundBackup }: State) {
        return (
            <div>
                <Button
                    secondary
                    disabled={this.props.disabled}
                    onClick={() => {this.checkBackup(backups); this.setState({ activeDialog: true }); }}>
                    {t('button.check')}
                </Button>
                {
                    activeDialog && (
                        <Dialog
                        title={message}
                        onClose={this.abort}
                        large={true}>
                            {
                                <div>
                                    { foundBackup !== undefined &&
                                    <BackupsListItem
                                        backup={foundBackup}
                                        handleChange={() => undefined}
                                        onFocus={() => undefined}
                                        radio={false}
                                    /> }
                                    <div className={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                        <Button primary onClick={this.abort}>
                                            {t('button.ok')}
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
