// SPDX-License-Identifier: Apache-2.0

import { Component } from 'react';
import { withTranslation } from 'react-i18next';
import { getDeviceInfo } from '../../../../api/bitbox01';
import UpgradeFirmware from '../components/upgradefirmware';
import { BitBox } from '../../../../components/icon/logo';
import style from '../bitbox01.module.css';

class RequireUpgrade extends Component {
  state = {
    firmwareVersion: null
  };

  componentDidMount() {
    getDeviceInfo(this.props.deviceID)
      .then(deviceInfo => {
        if (deviceInfo) {
          this.setState({
            firmwareVersion: deviceInfo.version.replace('v', ''),
          });
        }
      });
  }

  render() {
    const { t, deviceID } = this.props;
    const { firmwareVersion } = this.state;
    return (
      <div className="contentWithGuide">
        <div className={style.container}>
          <BitBox />
          <div className="box">
            <p className="m-top-none">{t('upgradeFirmware.label')}</p>
            <div className="buttons m-top-half">
              <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} asButton />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default withTranslation()(RequireUpgrade);
