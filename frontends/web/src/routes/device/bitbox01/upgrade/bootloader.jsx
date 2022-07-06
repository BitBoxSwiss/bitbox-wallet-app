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
import { apiGet, apiPost } from '../../../../utils/request';
import { apiWebsocket } from '../../../../utils/websocket';
import { BitBox } from '../../../../components/icon/logo';
import { Button } from '../../../../components/forms';
import style from '../bitbox01.module.css';

class Bootloader extends Component {
  constructor(props) {
    super(props);
    this.state = {
      upgrading: false,
      errMsg: null,
      progress: 0,
      upgradeSuccessful: false
    };
  }

  componentDidMount() {
    this.unsubscribe = apiWebsocket(this.onEvent);
    this.onStatusChanged();
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  onEvent = data => {
    if (data.type !== 'device') {
      return;
    }
    switch (data.data) {
    case 'bootloaderStatusChanged':
      this.onStatusChanged();
      break;
    default:
      break;
    }
  };

  onStatusChanged = () => {
    apiGet('devices/' + this.props.deviceID + '/bootloader-status')
      .then(({ upgrading, progress, upgradeSuccessful, errMsg }) => {
        this.setState({
          upgrading,
          progress,
          upgradeSuccessful,
          errMsg,
        });
      });
  };

  upgradeFirmware = () => {
    apiPost('devices/' + this.props.deviceID + '/bootloader/upgrade-firmware');
  };

  render() {
    const { t } = this.props;
    const {
      upgrading,
      progress,
      upgradeSuccessful,
      errMsg,
    } = this.state;
    let UpgradeOrStatus;

    if (upgrading) {
      if (upgradeSuccessful) {
        UpgradeOrStatus = <p className="m-none">{t('bootloader.success')}</p>;
      } else {
        const value = Math.round(progress * 100);
        UpgradeOrStatus = (
          <div>
            <progress value={value} max="100">{value}%</progress>
            <p className="m-bottom-none text-center">{t('bootloader.progress', {
              progress: value
            })}</p>
          </div>
        );
      }
    } else {
      UpgradeOrStatus = (
        <div className="buttons m-top-none">
          <Button
            primary
            onClick={this.upgradeFirmware}>
            {t('bootloader.button')}
          </Button>
        </div>
      );
    }
    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer">
            <div className="content narrow isVerticallyCentered">
              <div className={[style.container, style.scrollable].join(' ')}>
                <BitBox />
                <div className="box large">
                  {UpgradeOrStatus}
                  {
                    errMsg && (
                      <p className="m-bottom-none">{ errMsg }</p>
                    )
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default withTranslation()(Bootloader);
