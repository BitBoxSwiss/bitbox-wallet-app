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
import { Dialog } from '../../dialog/dialog';
import { Button } from '../../forms';
import Spinner from '../../spinner/Spinner';

interface CheckProps {
    deviceID: string;
    disabled: boolean;
}

type Props = CheckProps & TranslateProps;

interface State {
    activeDialog: boolean;
    message: string;
}

class Check extends Component<Props, State> {
    public state = {
        activeDialog: false,
        message: '',
    };

    private checkBackup = () => {
        apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/check', {
            silent: false,
        }).then(({ backupID, success }) => {
            let message;
            if (success && backupID) {
                message = this.props.t('backup.check.success', { name: backupID });
            } else {
                message = this.props.t('backup.check.notOK');
            }
            this.setState({ message });
        });
    }

    private abort = () => {
        this.setState({ activeDialog: false });
    }

    public render({ t }: RenderableProps<Props>, { activeDialog, message }: State) {
        return (
            <div>
                <Button
                    secondary
                    disabled={this.props.disabled}
                    onClick={() => {this.checkBackup(); this.setState({ activeDialog: true }); }}>
                    {t('button.check')}
                </Button>
                {
                    activeDialog && (
                        <Dialog
                        title={t('backup.check.title')}
                        onClose={this.abort}
                        large={true}>
                            { message ? (
                                <div>
                                    <p style="min-height: 3rem;">{message}</p>
                                    <div className={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                        <Button primary onClick={this.abort}>
                                            {t('button.ok')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div style="min-height: 6rem;">
                                    <Spinner text={t('backup.check.checking')} />
                                </div>
                            )}
                        </Dialog>
                    )
                }
            </div>
        );
    }
}

const HOC = translate<CheckProps>()(Check);
export { HOC as Check };
