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
import { Button } from '../../../components/forms';
import { DialogLegacy } from '../../../components/dialog/dialog-legacy';
import { PasswordSingleInput } from '../../../components/password';
import { apiPost } from '../../../utils/request';
// TODO: use DialogButtons
import style from '../../../components/dialog/dialog.module.css';

class Check extends Component {
  state = {
    password: null,
    activeDialog: false,
    message: null,
  };

  abort = () => {
    this.setState({
      password: null,
      activeDialog: false,
      message: null,
    });
  };

  handleFormChange = event => {
    this.setState({ [event.target.id]: event.target.value });
  };

  validate = () => {
    return this.props.selectedBackup && this.state.password;
  };

  check = event => {
    event.preventDefault();
    if (!this.validate()) {
      return;
    }
    this.setState({ message: this.props.t('backup.check.checking') });

    apiPost('devices/' + this.props.deviceID + '/backups/check', {
      password: this.state.password,
      filename: this.props.selectedBackup,
    }).catch(() => {}).then(({ success, matches, errorMessage }) => {
      let message;
      if (success) {
        if (matches) {
          message = this.props.t('backup.check.ok');
        } else {
          message = this.props.t('backup.check.notOK');
        }
      } else if (errorMessage) {
        message = errorMessage;
      }
      this.setState({ message });
    });
  };

  setValidPassword = password => {
    this.setState({ password });
  };

  render() {
    const {
      t,
      selectedBackup,
    } = this.props;
    const {
      activeDialog,
      message,
    } = this.state;
    return (
      <div>
        <Button
          secondary
          disabled={selectedBackup === null}
          onClick={() => this.setState({ activeDialog: true })}>
          {t('button.check')}
        </Button>
        {
          activeDialog && (
            <DialogLegacy
              title={t('backup.check.title')}
              onClose={this.abort}>
              { message ? (
                <div>
                  <p style={{ minHeight: '48px' }}>{message}</p>
                  <div className={style.actions}>
                    <Button secondary onClick={this.abort}>
                      {t('button.back')}
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={this.check}>
                  <PasswordSingleInput
                    label={t('backup.check.password.label')}
                    placeholder={t('backup.check.password.placeholder')}
                    showLabel={t('backup.check.password.showLabel')}
                    onValidPassword={this.setValidPassword} />
                  <div className={style.actions}>
                    <Button type="submit" primary disabled={!this.validate()}>
                      {t('button.check')}
                    </Button>
                    <Button secondary onClick={this.abort}>
                      {t('button.back')}
                    </Button>
                  </div>
                </form>
              )}
            </DialogLegacy>
          )
        }
      </div>
    );
  }
}

export default withTranslation()(Check);
