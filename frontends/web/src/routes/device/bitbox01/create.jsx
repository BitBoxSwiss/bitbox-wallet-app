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
import { withTranslation } from 'react-i18next';
import { Button, Input } from '../../../components/forms';
import { PasswordInput } from '../../../components/password';
import { alertUser } from '../../../components/alert/Alert';
import { apiPost } from '../../../utils/request';
import { Dialog } from '../../../components/dialog/dialog';
// TODO: use DialogButtons
import style from '../../../components/dialog/dialog.module.css';

class Create extends Component {
  state = {
    waiting: false,
    backupName: '',
    recoveryPassword: '',
    activeDialog: false,
  };

  abort = () => {
    this.setState({
      waiting: false,
      backupName: '',
      recoveryPassword: '',
      activeDialog: false,
    });
  };

  handleFormChange = event => {
    this.setState({ [event.target.id]: event.target.value });
  };

  validate = () => {
    return !this.state.waiting && this.state.backupName !== '';
  };

  create = event => {
    event.preventDefault();
    if (!this.validate()) {
      return;
    }
    this.setState({ waiting: true });
    apiPost('devices/' + this.props.deviceID + '/backups/create', {
      backupName: this.state.backupName,
      recoveryPassword: this.state.recoveryPassword,
    }).then(data => {
      this.abort();
      if (!data.success) {
        alertUser(data.errorMessage);
      } else {
        this.props.onCreate();
        if (!data.verification) {
          alertUser(this.props.t('backup.create.verificationFailed'));
        }
      }
    });
  };

  render() {
    const { t } = this.props;
    const {
      waiting,
      recoveryPassword,
      backupName,
      activeDialog,
    } = this.state;
    return (
      <div>
        <Button
          primary
          onClick={() => this.setState({ activeDialog: true })}>
          {t('button.create')}
        </Button>
        {
          activeDialog && (
            <Dialog
              title={t('backup.create.title')}
              onClose={this.abort}>
              <form onSubmit={this.create}>
                <Input
                  autoFocus
                  id="backupName"
                  label={t('backup.create.name.label')}
                  placeholder={t('backup.create.name.placeholder')}
                  onInput={this.handleFormChange}
                  value={backupName} />
                <p>{t('backup.create.info')}</p>
                <PasswordInput
                  id="recoveryPassword"
                  label={t('backup.create.password.label')}
                  placeholder={t('backup.create.password.placeholder')}
                  onInput={this.handleFormChange}
                  value={recoveryPassword} />
                <div className={style.actions}>
                  <Button type="submit" primary disabled={waiting || !this.validate()}>
                    {t('button.create')}
                  </Button>
                  <Button transparent onClick={this.abort}>
                    {t('button.abort')}
                  </Button>
                </div>
              </form>
            </Dialog>
          )
        }
      </div>
    );
  }
}

export default withTranslation()(Create);
