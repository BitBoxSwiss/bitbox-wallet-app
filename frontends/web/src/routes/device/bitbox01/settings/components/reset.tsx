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

import { Component } from 'react';
import { route } from '../../../../../utils/route';
import { withTranslation } from 'react-i18next';
import { Button, Checkbox } from '../../../../../components/forms';
import { DialogLegacy, DialogButtons } from '../../../../../components/dialog/dialog-legacy';
import { WaitDialog } from '../../../../../components/wait-dialog/wait-dialog';
import { PasswordInput } from '../../../../../components/password';
import { apiPost } from '../../../../../utils/request';
import { alertUser } from '../../../../../components/alert/Alert';
import style from '../../bitbox01.module.css';
import { SettingsButton } from '../../../../../components/settingsButton/settingsButton';

class Reset extends Component {
  state = {
    pin: null,
    isConfirming: false,
    activeDialog: false,
    understand: false,
  };

  handleUnderstandChange = (e) => {
    this.setState({ understand: e.target.checked });
  };

  resetDevice = () => {
    this.setState({
      activeDialog: false,
      isConfirming: true,
    });
    apiPost('devices/' + this.props.deviceID + '/reset', { pin: this.state.pin }).then(data => {
      this.abort();
      if (data.success) {
        if (data.didReset) {
          route('/', true);
        }
      } else if (data.errorMessage) {
        alertUser(this.props.t(`bitbox.error.e${data.code}`, {
          defaultValue: data.errorMessage,
        }));
      }
    });
  };

  setValidPIN = e => {
    this.setState({ pin: e.target.value });
  };

  abort = () => {
    this.setState({
      pin: null,
      understand: false,
      isConfirming: false,
      activeDialog: false,
    });
  };

  render() {
    const { t } = this.props;
    const {
      isConfirming,
      activeDialog,
      understand,
      pin,
    } = this.state;
    return (
      <div>
        <SettingsButton danger onClick={() => this.setState({ activeDialog: true })}>
          {t('reset.title')}
        </SettingsButton>
        {
          activeDialog && (
            <DialogLegacy
              title={t('reset.title')}
              onClose={this.abort}>
              <p>
                {t('reset.description')}
              </p>
              <PasswordInput
                id="pin"
                label={t('initialize.input.label')}
                value={pin}
                onInput={this.setValidPIN} />
              <div className={style.agreements}>
                <Checkbox
                  id="funds_access"
                  label={t('reset.understand')}
                  checked={understand}
                  onChange={this.handleUnderstandChange} />
              </div>
              <DialogButtons>
                <Button danger disabled={!pin || !understand} onClick={this.resetDevice}>
                  {t('reset.title')}
                </Button>
                <Button secondary onClick={this.abort} disabled={isConfirming}>
                  {t('button.back')}
                </Button>
              </DialogButtons>
            </DialogLegacy>
          )
        }
        { isConfirming ? (
          <WaitDialog title={t('reset.title')} />
        ) : null }
      </div>
    );
  }
}

export default withTranslation()(Reset);
