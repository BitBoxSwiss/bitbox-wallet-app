// SPDX-License-Identifier: Apache-2.0

import { Component } from 'react';
import { withTranslation } from 'react-i18next';
import { SettingsButton } from '../../../../../components/settingsButton/settingsButton';
import { apiPost } from '../../../../../utils/request';

class Blink extends Component {
  blinkDevice = () => {
    apiPost('devices/' + this.props.deviceID + '/blink');
  };

  render() {
    const { t } = this.props;
    return (
      <SettingsButton onClick={this.blinkDevice}>{t('blink.button')}</SettingsButton>
    );
  }
}

export default withTranslation()(Blink);
