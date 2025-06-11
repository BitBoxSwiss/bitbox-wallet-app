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
import { Guide } from '../../../../components/guide/guide';
import { Entry } from '../../../../components/guide/entry';
import { Header } from '../../../../components/layout';
import { Spinner } from '../../../../components/spinner/Spinner';
import Blink from './components/blink';
import RandomNumber from './components/randomnumber';
import ChangePIN from './components/changepin';
import Reset from './components/reset';
import UpgradeFirmware from '../components/upgradefirmware';
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';
import { SettingsItem } from '../../../../components/settingsButton/settingsItem';

type Props = {
  deviceID: string;
};

export const Settings = ({ deviceID }: Props) => {
  const { t } = useTranslation();

  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [spinner, setSpinner] = useState(true);
  const [sdcard, setSdcard] = useState(false);
  const [serial, setSerial] = useState('');

  useEffect(() => {
    const init = async () => {
      const deviceInfo = await getDeviceInfo(deviceID);
      if (deviceInfo) {
        const {
          name,
          sdcard,
          serial,
          version,
        } = deviceInfo;

        setFirmwareVersion(version.replace('v', ''));
        setName(name);
        setSdcard(sdcard);
        setSerial(serial);
        setSpinner(false);
      }

      const bundledVersion = await apiGet(`devices/${deviceID}/bundled-firmware-version`);
      setNewVersion(bundledVersion.replace('v', ''));
    };

    init();

  }, [deviceID]);

  const canUpgrade = firmwareVersion && newVersion !== firmwareVersion;

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
                    <Reset deviceID={deviceID} />
                  </div>
                </div>
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
                  <h3 className="subTitle m-top-default">{t('deviceSettings.hardware.title')}</h3>
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
      </Guide>
    </div>
  );
};

export default Settings;
