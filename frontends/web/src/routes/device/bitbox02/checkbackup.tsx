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
import * as bitbox02API from '../../../api/bitbox02';
import { translate, TranslateProps } from '../../../decorators/translate';
import { Backup, BackupsListItem } from '../components/backup';
import { alertUser } from '../../../components/alert/Alert';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { Button } from '../../../components/forms';

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
  public readonly state: State = {
    activeDialog: false,
    message: '',
    foundBackup: undefined,
    userVerified: false,
  };

  private checkBackup = async () => {
    try {
      const backupID = await bitbox02API.checkBackup(this.props.deviceID, true);
      const foundBackup = this.props.backups.find((backup: Backup) => backup.id === backupID);
      if (!foundBackup) {
        alertUser(this.props.t('unknownError', { errorMessage: 'Not found' }));
        return;
      }
      this.setState({
        foundBackup,
        activeDialog: true,
        message: this.props.t('backup.check.success'),
      });
      await bitbox02API.checkBackup(this.props.deviceID, false);
      this.setState({ userVerified: true });
    } catch {
      this.setState({ activeDialog: true, message: this.props.t('backup.check.notOK'), userVerified: true });
    }
  };

  private abort = () => {
    this.setState({ activeDialog: false, userVerified: false });
  };

  public render() {
    const { t } = this.props;
    const { activeDialog, message, foundBackup, userVerified } = this.state;
    return (
      <div>
        <Button
          primary
          disabled={this.props.disabled}
          onClick={this.checkBackup}
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
                  <DialogButtons>
                    <Button
                      primary
                      onClick={this.abort}
                      disabled={!userVerified}
                    >
                      { userVerified ? t('button.ok') : t('accountInfo.verify') }
                    </Button>
                  </DialogButtons>
                </div>
              }
            </Dialog>
          )
        }
      </div>
    );
  }
}

const HOC = translate()(Check);
export { HOC as Check };
