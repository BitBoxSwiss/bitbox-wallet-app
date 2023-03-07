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
import { route } from '../../../../utils/route';
import { getDeviceInfo } from '../../../../api/bitbox01';
import { apiGet } from '../../../../utils/request';
import { apiWebsocket } from '../../../../utils/websocket';
import { Guide } from '../../../../components/guide/guide';
import { Entry } from '../../../../components/guide/entry';
import { Header } from '../../../../components/layout';
import { Spinner } from '../../../../components/spinner/Spinner';
import Blink from './components/blink';
import LegacyHiddenWallet from './components/legacyhiddenwallet';
import RandomNumber from './components/randomnumber';
import HiddenWallet from './components/hiddenwallet';
import ChangePIN from './components/changepin';
import Reset from './components/reset';
import { MobilePairing } from './components/mobile-pairing';
import DeviceLock from './components/device-lock';
import UpgradeFirmware from '../components/upgradefirmware';
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';
import { SettingsItem } from '../../../../components/settingsButton/settingsItem';

class Settings extends Component {
  state = {
    firmwareVersion: null,
    newVersion: null,
    lock: true,
    name: null,
    spinner: true,
    sdcard: false,
    pairing: false,
    mobileChannel: false,
    connected: false,
    newHiddenWallet: true,
  };

  componentDidMount() {
    getDeviceInfo(this.props.deviceID)
      .then(({
        lock,
        name,
        new_hidden_wallet,
        pairing,
        sdcard,
        version,
      }) => {
        this.setState({
          firmwareVersion: version.replace('v', ''),
          lock,
          name,
          newHiddenWallet: new_hidden_wallet,
          pairing,
          sdcard,
          spinner: false,
        });
      });

    apiGet('devices/' + this.props.deviceID + '/has-mobile-channel').then(mobileChannel => {
      this.setState({ mobileChannel });
    });

    apiGet('devices/' + this.props.deviceID + '/bundled-firmware-version').then(version => {
      this.setState({ newVersion: version.replace('v', '') });
    });

    this.unsubscribe = apiWebsocket(({ type, data, deviceID }) => {
      if (type === 'device') {
        if (deviceID !== this.props.deviceID) {
          return;
        }
        switch (data) {
        case 'mobileDisconnected':
          this.setState({ connected: false });
          break;
        case 'mobileConnected':
          this.setState({ connected: true });
          break;
        case 'pairingSuccess':
          this.setState({ pairing: true, mobileChannel: true });
          break;
        case 'pairingFalse':
          this.setState({ mobileChannel: false });
          break;
        default:
          break;
        }

      }
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const {
      t,
      deviceID,
    } = this.props;
    const {
      firmwareVersion,
      newVersion,
      lock,
      name,
      spinner,
      sdcard,
      pairing,
      mobileChannel,
      connected,
      newHiddenWallet,
    } = this.state;
    const canUpgrade = firmwareVersion && newVersion !== firmwareVersion;
    const paired = pairing && mobileChannel;
    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer scrollableContainer">
            <Header title={<h2>{name === null ? '' : name || 'BitBox'}</h2>} />
            <div className="content padded">
              <div className="columnsContainer">
                <div className="columns">
                  <div className="column column-1-2">
                    <h3 className="subTitle">{t('deviceSettings.secrets.title')}</h3>
                    <div className="box slim divide">
                      <SettingsButton onClick={() => route(`/manage-backups/${deviceID}`)}>
                        {t('deviceSettings.secrets.manageBackups')}
                      </SettingsButton>
                      <ChangePIN deviceID={deviceID} />
                      {
                        newHiddenWallet ? (
                          <HiddenWallet deviceID={deviceID} disabled={lock} />
                        ) : (
                          <LegacyHiddenWallet
                            deviceID={deviceID}
                            newHiddenWallet={newHiddenWallet}
                            disabled={lock}
                            onChange={value => this.setState({ newHiddenWallet: value })}
                          />
                        )
                      }
                      <Reset deviceID={deviceID} />
                    </div>
                  </div>
                  <div className="column column-1-2">
                    <h3 className="subTitle">{t('deviceSettings.pairing.title')}</h3>
                    <div className="box slim divide">
                      <SettingsItem optionalText={t(`deviceSettings.pairing.mobile.${connected}`)}>
                        {t('deviceSettings.pairing.mobile.label')}
                      </SettingsItem>
                      <MobilePairing
                        deviceID={deviceID}
                        deviceLocked={lock}
                        hasMobileChannel={mobileChannel}
                        paired={paired}
                        onPairingEnabled={() => this.setState({ pairing: true })}
                      />
                      <DeviceLock
                        lock={lock}
                        deviceID={deviceID}
                        onLock={() => this.setState({ lock: true })}
                        disabled={lock || !paired} />
                    </div>
                  </div>
                </div>
                <div className="columns">
                  <div className="column column-1-2">
                    <h3 className="subTitle">{t('deviceSettings.firmware.title')}</h3>
                    <div className="box slim divide">
                      {
                        canUpgrade ? (
                          <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                        ) : (
                          <SettingsItem optionalText={`${t('deviceSettings.firmware.version.label')} ${firmwareVersion ? firmwareVersion : t('loading')}`}>
                            {t('deviceSettings.firmware.upToDate')}
                          </SettingsItem>
                        )
                      }
                    </div>
                  </div>
                  <div className="column column-1-2">
                    <h3 className="subTitle">{t('deviceSettings.hardware.title')}</h3>
                    <div className="box slim divide">
                      <SettingsItem optionalText={t(`deviceSettings.hardware.sdcard.${sdcard}`)}>
                        {t('deviceSettings.hardware.sdcard.label')}
                      </SettingsItem>
                      <RandomNumber apiPrefix={'devices/' + deviceID} />
                      <Blink deviceID={deviceID} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            { spinner && <Spinner guideExists text={t('deviceSettings.loading')} /> }
          </div>
        </div>
        <Guide>
          <Entry key="guide.bitbox.ejectBitbox" entry={t('guide.bitbox.ejectBitbox')} />
          <Entry key="guide.bitbox.ejectSD" entry={t('guide.bitbox.ejectSD')} />
          <Entry key="guide.bitbox.hiddenWallet" entry={t('guide.bitbox.hiddenWallet')} />
          { !lock && newHiddenWallet && (
            <Entry key="guide.bitbox.legacyHiddenWallet" entry={t('guide.bitbox.legacyHiddenWallet')}>
              <p>
                <LegacyHiddenWallet
                  deviceID={deviceID}
                  newHiddenWallet={newHiddenWallet}
                  onChange={value => this.setState({ newHiddenWallet: value })}
                />
              </p>
            </Entry>
          )}
          <Entry key="guide.bitbox.pairing" entry={t('guide.bitbox.pairing')} />
          <Entry key="guide.bitbox.2FA" entry={t('guide.bitbox.2FA')} />
          <Entry key="guide.bitbox.disable2FA" entry={t('guide.bitbox.disable2FA')} />
        </Guide>
      </div>
    );
  }
}

export default withTranslation()(Settings);
