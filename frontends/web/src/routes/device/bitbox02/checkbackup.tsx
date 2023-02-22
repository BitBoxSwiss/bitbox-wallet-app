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
    const { t } = this.props;
    this.setState({ message: t('backup.check.confirmTitle') });
    try {
      const backupID = await bitbox02API.checkBackup(this.props.deviceID, true);
      const foundBackup = this.props.backups.find((backup: Backup) => backup.id === backupID);
      if (!foundBackup) {
        alertUser(t('unknownError', { errorMessage: 'Not found' }));
        return;
      }
      this.setState({
        activeDialog: true,
        foundBackup,
      });
      await bitbox02API.checkBackup(this.props.deviceID, false);
      this.setState({
        message: t('backup.check.success'),
        userVerified: true,
      });
    } catch {
      this.setState({
        activeDialog: true,
        message: t('backup.check.notOK'),
        userVerified: true,
      });
    }
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
        <Dialog open={activeDialog} title={message}>
          <form onSubmit={(e) => {
            e.preventDefault();
            this.setState({
              activeDialog: false,
              userVerified: false,
            });
          }}>
            { foundBackup !== undefined && (
              <BackupsListItem
                backup={foundBackup}
                handleChange={() => undefined}
                onFocus={() => undefined}
                radio={false} />
            )}
            <DialogButtons>
              {userVerified && (
                <Button
                  autoFocus
                  disabled={!userVerified}
                  primary
                  type="submit">
                  { userVerified ? t('button.ok') : t('accountInfo.verify') }
                </Button>
              )}
            </DialogButtons>
          </form>
        </Dialog>
      </div>
    );
  }
}

const HOC = translate()(Check);
export { HOC as Check };
