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

import React, { ChangeEvent, Component } from 'react';
import { route } from '../../../utils/route';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { alertUser } from '../../../components/alert/Alert';
import { DialogLegacy, DialogButtons } from '../../../components/dialog/dialog-legacy';
import { Button, Checkbox } from '../../../components/forms';
import { PasswordRepeatInput } from '../../../components/password';
import { Spinner } from '../../../components/spinner/Spinner';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';
import style from '../components/backups.module.css';

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
    password?: string | null;
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
  };

  private validate = () => {
    return this.props.selectedBackup && this.state.password;
  };

  private restore = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!this.validate()) {
      return;
    }
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
  };

  private handleUnderstandChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({ understand: e.target.checked });
  };

  private setValidPassword = (password: string | null) => {
    this.setState({ password });
  };

  public render() {
    const {
      t,
      selectedBackup,
      requireConfirmation,
    } = this.props;
    const {
      isConfirming,
      activeDialog,
      isLoading,
      understand,
    } = this.state;
    return (
      <span>
        <Button
          {...(requireConfirmation ? { danger: true } : { primary: true })}
          disabled={!selectedBackup}
          onClick={() => this.setState({ activeDialog: true })}>
          {t('button.restore')}
        </Button>
        {
          activeDialog && (
            <DialogLegacy
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
                    {...(requireConfirmation ? { danger: true } : { primary: true })}
                    disabled={!understand || !this.validate() || isConfirming}>
                    {t('button.restore')}
                  </Button>
                  <Button
                    secondary
                    onClick={this.abort}
                    disabled={isConfirming}>
                    {t('button.back')}
                  </Button>
                </DialogButtons>
              </form>
            </DialogLegacy>
          )
        }
        {
          (isConfirming && requireConfirmation) && (
            <WaitDialog title={t('backup.restore.confirmTitle')} />
          )
        }
        {
          isLoading && (
            <Spinner guideExists={false} text={t('backup.restore.restoring')} />
          )
        }
      </span>
    );
  }
}

const TranslatedRestore = translate()(Restore);
export { TranslatedRestore as Restore };
