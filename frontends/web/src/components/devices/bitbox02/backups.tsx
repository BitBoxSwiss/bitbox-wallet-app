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
import alertOctagon from '../../../assets/icons/alert-octagon.svg';
import * as style from '../../../components/steps/steps.css';
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { Backup, BackupsListItem } from '../../backups/backup';
import { Button } from '../../forms';

interface LoadedBackupsProps {
    backups: {
        success: boolean;
        backups?: Backup[];
    };
}

interface BackupsProps {
    deviceID: string;
    showRestore: boolean;
}

type Props = LoadedBackupsProps & BackupsProps & TranslateProps;

interface State {
    selectedBackup?: string;
    restoring: boolean;
    errorText: string;
}

class Backups extends Component<Props, State> {
    private restore = () => {
        if (!this.state.selectedBackup) {
            return;
        }
        this.setState({ restoring: true });
        apiPost(
            'devices/bitbox02/' + this.props.deviceID + '/backups/restore',
            this.state.selectedBackup).then(({ success }) => {
            this.setState({
                restoring: false,
                errorText: success ? '' : 'Error restoring the backup',
            });
        });
    }
    public render(
        { t,
          backups,
          showRestore,
        }: RenderableProps<Props>,
        { selectedBackup,
          restoring,
          errorText,
        }: State) {
        if (!backups.success) {
            return <div>Error fetching backups</div>;
        }
        return (
            <div>
                {
                    errorText && (
                        <div className={style.standOut}>
                            <img src={alertOctagon} />
                            <span className={style.error}>{errorText}</span>
                        </div>
                    )
                }
            {
                backups.backups!.length ? backups.backups!.map(backup => (
                    <BackupsListItem
                        key={backup.id}
                        disabled={restoring}
                        backup={backup}
                        selectedBackup={selectedBackup}
                        handleChange={(b => this.setState({ selectedBackup: b }))}
                        onFocus={() => undefined}/>
                )) : (
                    <p>
                        {t('backup.noBackups')}
                    </p>
                )
            }
            { showRestore && (
                <Button
                    primary={true}
                    disabled={!selectedBackup || restoring}
                    onClick={this.restore}>
                    {t('button.restore')}
                </Button>
            ) }
            </div>
        );
    }
}

const loadHOC = load<LoadedBackupsProps, BackupsProps & TranslateProps>(({ deviceID }) => ({ backups: 'devices/bitbox02/' + deviceID + '/backups/list' }))(Backups);
const HOC = translate<BackupsProps>()(loadHOC);
export { HOC as Backups };
