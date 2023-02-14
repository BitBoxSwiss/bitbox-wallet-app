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

import { Component } from 'react';
import { restoreBackup } from '../../../api/bitbox02';
import Toast from '../../../components/toast/Toast';
import { subscribe } from '../../../decorators/subscribe';
import { translate, TranslateProps } from '../../../decorators/translate';
import { Backup, BackupsListItem } from '../components/backup';
import backupStyle from '../components/backups.module.css';
import { Button } from '../../../components/forms';
import { Check } from './checkbackup';
import { Create } from './createbackup';

interface SubscribedBackupsProps {
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
    backupOnBeforeRestore?: (backup: Backup) => void;
    backupOnAfterRestore?: (success: boolean) => void;
}

type Props = SubscribedBackupsProps & BackupsProps & TranslateProps;

interface State {
    selectedBackup?: string;
    restoring: boolean;
    errorText: string;
    creatingBackup: boolean;
}

class Backups extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      restoring: false,
      errorText: '',
      creatingBackup: false,
    };
  }

  private restore = () => {
    if (!this.state.selectedBackup || !this.props.backups.backups) {
      return;
    }
    const backup = this.props.backups.backups.find(b => b.id === this.state.selectedBackup);
    if (!backup) {
      return;
    }
    this.setState({ restoring: true });
    if (this.props.backupOnBeforeRestore) {
      this.props.backupOnBeforeRestore(backup);
    }
    restoreBackup(this.props.deviceID, this.state.selectedBackup)
      .then(({ success }) => {
        this.setState({
          restoring: false,
          errorText: success ? '' : this.props.t('backup.restore.error.general'),
        });
        if (this.props.backupOnAfterRestore) {
          this.props.backupOnAfterRestore(success);
        }
      });
  };

  public render() {
    const {
      t,
      children,
      backups,
      showRestore,
      showCreate,
      showRadio,
      deviceID,
    } = this.props;
    const { selectedBackup,
      restoring,
      errorText,
    } = this.state;
    if (!backups.success) {
      return <div>Error fetching backups</div>;
    }
    return (
      <div>
        <div className={backupStyle.stepContext}>
          {
            errorText && (
              <Toast theme="warning">
                {errorText}
              </Toast>
            )
          }
          <div className={backupStyle.backupsList}>
            {
                            backups.backups!.length ? (
                              <div className={backupStyle.listContainer}>
                                {
                                        backups.backups!.map(backup => (
                                          <div key={backup.id} className={backupStyle.item}>
                                            <BackupsListItem
                                              disabled={restoring}
                                              backup={backup}
                                              selectedBackup={selectedBackup}
                                              handleChange={(b => this.setState({ selectedBackup: b }))}
                                              onFocus={() => undefined}
                                              radio={showRadio} />
                                          </div>
                                        ))
                                }
                              </div>
                            ) : (
                              <p>{t('backup.noBackups')}</p>
                            )
            }
          </div>
          <div className={backupStyle.backupButtons}>
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
                <Create deviceID={deviceID} />
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
            {children}
          </div>
        </div>
      </div>
    );
  }
}

const subscribeHOC = subscribe<SubscribedBackupsProps, BackupsProps & TranslateProps>(({ deviceID }) => ({ backups: 'devices/bitbox02/' + deviceID + '/backups/list' }))(Backups);
const HOC = translate()(subscribeHOC);
export { HOC as BackupsV2 };
