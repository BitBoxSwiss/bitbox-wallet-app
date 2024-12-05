/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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
