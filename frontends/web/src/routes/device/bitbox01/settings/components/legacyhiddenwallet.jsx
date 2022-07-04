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
import { Button } from '../../../../../components/forms';
import { alertUser } from '../../../../../components/alert/Alert';
import { apiPost } from '../../../../../utils/request';

class LegacyHiddenWallet extends Component {
  toggle = () => {
    const newValue = !this.props.newHiddenWallet;
    apiPost('devices/' + this.props.deviceID + '/feature-set', {
      new_hidden_wallet: newValue,
    }).then(() => {
      if (newValue) {
        alertUser(this.props.t('legacyhiddenwallet.successDisable'));
      } else {
        alertUser(this.props.t('legacyhiddenwallet.successEnable'));
      }
      if (this.props.onChange) {
        this.props.onChange(newValue);
      }
    });
  };

  render() {
    const {
      t,
      disabled,
      newHiddenWallet,
    } = this.props;
    return (
      <Button
        danger
        disabled={disabled}
        onclick={this.toggle}>
        { newHiddenWallet ? t('legacyhiddenwallet.enable') : t('legacyhiddenwallet.disable') }
      </Button>
    );
  }
}

export default withTranslation()(LegacyHiddenWallet);
