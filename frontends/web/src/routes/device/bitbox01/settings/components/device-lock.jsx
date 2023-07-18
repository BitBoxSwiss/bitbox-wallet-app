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
import { withTranslation } from 'react-i18next';
import { Button } from '../../../../../components/forms';
import { DialogLegacy } from '../../../../../components/dialog/dialog-legacy';
import { WaitDialog } from '../../../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../../../utils/request';
import { SettingsButton } from '../../../../../components/settingsButton/settingsButton';
// TODO: use DialogButtons
import style from '../../../../../components/dialog/dialog.module.css';

class DeviceLock extends Component {
  state = {
    isConfirming: false,
    activeDialog: false,
  };

  resetDevice = () => {
    this.setState({
      activeDialog: false,
      isConfirming: true,
    });
    apiPost('devices/' + this.props.deviceID + '/lock').then(didLock => {
      this.setState({
        isConfirming: false,
      });
      if (didLock) {
        this.props.onLock();
      }
    });
  };

  abort = () => {
    this.setState({ activeDialog: false });
  };

  render() {
    const {
      t,
      disabled,
      lock,
    } = this.props;
    const {
      isConfirming,
      activeDialog,
    } = this.state;
    return (
      <div>
        <SettingsButton
          danger
          onClick={() => this.setState({ activeDialog: true })}
          disabled={disabled}
          optionalText={t(`deviceSettings.pairing.lock.${lock}`)}>
          {t('deviceLock.button')}
        </SettingsButton>
        {
          activeDialog && (
            <DialogLegacy
              title={t('deviceLock.title')}
              onClose={this.abort}>
              <p>{t('deviceLock.condition1')}</p>
              <p>{t('deviceLock.condition2')}</p>
              <p>{t('deviceLock.condition3')}</p>
              <div className={style.actions}>
                <Button danger onClick={this.resetDevice}>
                  {t('deviceLock.confirm')}
                </Button>
                <Button secondary onClick={this.abort}>
                  {t('button.back')}
                </Button>
              </div>
            </DialogLegacy>
          )
        }
        {
          isConfirming && (
            <WaitDialog title={t('deviceLock.title')} />
          )
        }
      </div>
    );
  }
}

export default withTranslation()(DeviceLock);
