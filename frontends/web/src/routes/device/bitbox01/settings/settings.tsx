/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022-2025 Shift Crypto AG
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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { route } from '../../../../utils/route';
import { getDeviceInfo } from '../../../../api/bitbox01';
import { apiGet } from '../../../../utils/request';
import { apiWebsocket } from '../../../../utils/websocket';
import { hasMobileChannel } from '@/api/devices';
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
import { TEventLegacy } from '@/utils/transport-common';

type Props = {
  deviceID: string;
};

export const Settings = ({ deviceID }: Props) => {
  const { t } = useTranslation();

  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [lock, setLock] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const [spinner, setSpinner] = useState(true);
  const [sdcard, setSdcard] = useState(false);
  const [serial, setSerial] = useState('');
  const [pairing, setPairing] = useState(false);
  const [mobileChannel, setMobileChannel] = useState(false);
  const [connected, setConnected] = useState(false);
  const [newHiddenWallet, setNewHiddenWallet] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;

    const init = async () => {
      const deviceInfo = await getDeviceInfo(deviceID);
      if (deviceInfo) {
        const {
          lock,
          name,
          new_hidden_wallet,
          pairing,
          sdcard,
          serial,
          version,
        } = deviceInfo;

        setFirmwareVersion(version.replace('v', ''));
        setLock(lock);
        setName(name);
        setNewHiddenWallet(new_hidden_wallet);
        setPairing(pairing);
        setSdcard(sdcard);
        setSerial(serial);
        setSpinner(false);
      }

      const mobile = await hasMobileChannel(deviceID)();
      setMobileChannel(mobile);

      const bundledVersion = await apiGet(`devices/${deviceID}/bundled-firmware-version`);
      setNewVersion(bundledVersion.replace('v', ''));

      unsubscribe = apiWebsocket((arg) => {
        const { type, data, deviceID: id } = arg as TEventLegacy;
        if (type === 'device' && id === deviceID) {
          switch (data) {
          case 'mobileDisconnected':
            setConnected(false);
            break;
          case 'mobileConnected':
            setConnected(true);
            break;
          case 'pairingSuccess':
            setPairing(true);
            setMobileChannel(true);
            break;
          case 'pairingFalse':
            setMobileChannel(false);
            break;
          default:
            break;
          }
        }
      });
    };

    init();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [deviceID]);

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
                    {newHiddenWallet ? (
                      <HiddenWallet deviceID={deviceID} disabled={lock} />
                    ) : (
                      <LegacyHiddenWallet
                        deviceID={deviceID}
                        newHiddenWallet={newHiddenWallet}
                        disabled={lock}
                        onChange={setNewHiddenWallet}
                      />
                    )}
                    <Reset deviceID={deviceID} />
                  </div>
                </div>
                <div className="column column-1-2">
                  <h3 className="subTitle">{t('deviceSettings.pairing.title')}</h3>
                  <div className="box slim divide">
                    <SettingsItem optionalText={t(`deviceSettings.pairing.mobile.${connected ? 'true' : 'false'}`)}>
                      {t('deviceSettings.pairing.mobile.label')}
                    </SettingsItem>
                    <MobilePairing
                      deviceID={deviceID}
                      deviceLocked={lock}
                      hasMobileChannel={mobileChannel}
                      paired={paired}
                      onPairingEnabled={() => setPairing(true)}
                    />
                    <DeviceLock
                      lock={lock}
                      deviceID={deviceID}
                      onLock={() => setLock(true)}
                      disabled={lock || !paired}
                    />
                  </div>
                </div>
              </div>
              <div className="columns">
                <div className="column column-1-2">
                  <h3 className="subTitle">{t('deviceSettings.firmware.title')}</h3>
                  <div className="box slim divide">
                    {canUpgrade ? (
                      <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                    ) : (
                      <SettingsItem optionalText={`${t('deviceSettings.firmware.version.label')} ${firmwareVersion || t('loading')}`}>
                        {t('deviceSettings.firmware.upToDate')}
                      </SettingsItem>
                    )}
                  </div>
                </div>
                <div className="column column-1-2">
                  <h3 className="subTitle">{t('deviceSettings.hardware.title')}</h3>
                  <div className="box slim divide">
                    <SettingsItem optionalText={serial}>Serial number</SettingsItem>
                    <SettingsItem optionalText={t(`deviceSettings.hardware.sdcard.${sdcard ? 'true' : 'false' }`)}>
                      {t('deviceSettings.hardware.sdcard.label')}
                    </SettingsItem>
                    <RandomNumber apiPrefix={`devices/${deviceID}`} />
                    <Blink deviceID={deviceID} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {spinner && <Spinner text={t('deviceSettings.loading')} />}
        </div>
      </div>
      <Guide>
        <Entry key="guide.bitbox.ejectBitbox" entry={t('guide.bitbox.ejectBitbox', { returnObjects: true })} />
        <Entry key="guide.bitbox.ejectSD" entry={t('guide.bitbox.ejectSD', { returnObjects: true })} />
        <Entry key="guide.bitbox.hiddenWallet" entry={t('guide.bitbox.hiddenWallet', { returnObjects: true })} />
        {!lock && newHiddenWallet && (
          <Entry key="guide.bitbox.legacyHiddenWallet" entry={t('guide.bitbox.legacyHiddenWallet', { returnObjects: true })}>
            <p>
              <LegacyHiddenWallet
                deviceID={deviceID}
                newHiddenWallet={newHiddenWallet}
                onChange={setNewHiddenWallet}
              />
            </p>
          </Entry>
        )}
        <Entry key="guide.bitbox.pairing" entry={t('guide.bitbox.pairing', { returnObjects: true })} />
        <Entry key="guide.bitbox.2FA" entry={t('guide.bitbox.2FA', { returnObjects: true })} />
        <Entry key="guide.bitbox.disable2FA" entry={t('guide.bitbox.disable2FA', { returnObjects: true })} />
      </Guide>
    </div>
  );
};

export default Settings;
