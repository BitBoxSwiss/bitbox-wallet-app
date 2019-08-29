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
import SimpleMarkup from '../../../utils/simplemarkup';
import { Backup, BackupsListItem } from '../../backups/backup';
import * as backupStyle from '../../backups/backups.css';
import { Button } from '../../forms';
import { Check } from './checkbackup';
import { Create } from './createbackup';

interface LoadedBackupsProps {
    backups: {
        success: boolean;
        backups?: Backup[];
    };
}

interface BackupsProps {
    deviceID: string;
    showRestore?: boolean;
    showCreate?: boolean;
    showRadio: boolean;
    backupOnBeforeRestore?: () => void;
    backupOnAfterRestore?: (success: boolean) => void;
}

type Props = LoadedBackupsProps & BackupsProps & TranslateProps;

interface State {
    selectedBackup?: string;
    restoring: boolean;
    errorText: string;
    creatingBackup: boolean;
}

class Backups extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            restoring: false,
            errorText: '',
            creatingBackup: false,
        };
    }

    private restore = () => {
        if (!this.state.selectedBackup) {
            return;
        }
        this.setState({ restoring: true });
        if (this.props.backupOnBeforeRestore) {
            this.props.backupOnBeforeRestore();
        }
        apiPost(
            'devices/bitbox02/' + this.props.deviceID + '/backups/restore',
            this.state.selectedBackup).then(({ success }) => {
                this.setState({
                    restoring: false,
                    errorText: success ? '' : 'Error restoring the backup',
                });
                if (this.props.backupOnAfterRestore) {
                    this.props.backupOnAfterRestore(success);
                }
            }
        );
    }

    public render(
        { t,
          children,
          backups,
          showRestore,
          showCreate,
          showRadio,
          deviceID,
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
                <div className={style.stepContext}>
                    {
                        errorText && (
                            <div className={style.standOut}>
                                <img src={alertOctagon} />
                                <span className={style.error}>{errorText}</span>
                            </div>
                        )
                    }
                    <div class={backupStyle.backupsList}>
                        {
                            backups.backups!.length ? (
                                <div>
                                    <SimpleMarkup tagName="p" markup={t('backup.list')} />
                                    <div className={backupStyle.listContainer}>
                                        {
                                            backups.backups!.map(backup => (
                                                <table className={style.table}>
                                                    <BackupsListItem
                                                        key={backup.id}
                                                        disabled={restoring}
                                                        backup={backup}
                                                        selectedBackup={selectedBackup}
                                                        handleChange={(b => this.setState({ selectedBackup: b }))}
                                                        onFocus={() => undefined}
                                                        radio={showRadio} />
                                                </table>
                                            ))
                                        }
                                    </div>
                                </div>
                            ) : (
                                <p>{t('backup.noBackups')}</p>
                            )
                        }
                    </div>
                </div>
                <div class="buttons text-center">
                    {children}
                    {
                        showRestore && (
                            <Button
                                primary={true}
                                disabled={!selectedBackup || restoring}
                                onClick={this.restore}>
                                {t('button.restore')}
                            </Button>
                        )
                    }
                    {
                        showCreate && (
                            <Check
                                deviceID={deviceID}
                                backups={backups.backups ? backups.backups : []}
                                disabled={backups.backups!.length === 0}
                            />
                        )
                    }
                    {
                        showCreate && (
                            <Create deviceID={deviceID} />
                        )
                    }
                </div>
            </div>
        );
    }
}

const loadHOC = load<LoadedBackupsProps, BackupsProps & TranslateProps>(({ deviceID }) => ({ backups: 'devices/bitbox02/' + deviceID + '/backups/list' }))(Backups);
const HOC = translate<BackupsProps>()(loadHOC);
export { HOC as BackupsV2 };
