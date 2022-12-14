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

import { useEffect, useState } from 'react';
import { route } from '../../../utils/route';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../../hooks/api';
import { getDeviceInfo, DeviceInfo, getVersion, verifyAttestation } from '../../../api/bitbox02';
import { Checked, Warning } from '../../../components/icon/icon';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { SettingsItem } from '../../../components/settingsButton/settingsItem';
import { GotoStartupSettings } from './gotostartupsettings';
import { Reset } from './reset';
import { SetDeviceName } from './setdevicename';
import { ShowMnemonic } from './showmnemonic';
import { UpgradeButton } from './upgradebutton';
import { alertUser } from '../../../components/alert/Alert';
import { ManageDeviceGuide } from './settings-guide';
import { View, ViewContent, ViewHeader } from '../../../components/view/view';
import { Column, Grid, Header, Main } from '../../../components/layout';

type TProps = {
    deviceID: string;
}

export const Settings = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>();
  const [attestation, setAttestation] = useState<boolean | null>(null);
  useEffect(() => {
    getDeviceInfo(deviceID).then(setDeviceInfo).catch(error => {
      console.error(error);
      alertUser(t('genericError'));
    });
    verifyAttestation(deviceID).then(setAttestation);
  }, [deviceID, t]);

  const versionInfo = useLoad(() => getVersion(deviceID), [deviceID]);
  const apiPrefix = 'devices/bitbox02/' + deviceID;

  const routeToPassphrase = () => {
    route(`/passphrase/${deviceID}`);
  };

  if (deviceInfo === undefined) {
    return null;
  }
  return (
    <Main>
      <Header />
      <View fullscreen={false} withBottomBar>
        <ViewHeader small title={t('sidebar.device')} />
        <ViewContent>
          <Grid>
            <Column>
              <h3 className="subTitle">{t('deviceSettings.secrets.title')}</h3>
              <SettingsButton onClick={() => route(`/manage-backups/${deviceID}`)}>
                {t('deviceSettings.secrets.manageBackups')}
              </SettingsButton>
              <ShowMnemonic apiPrefix={apiPrefix} />
              <Reset apiPrefix={apiPrefix} />
            </Column>
            <Column>
              <h3 className="subTitle">{t('deviceSettings.hardware.title')}</h3>
              <SetDeviceName
                deviceName={deviceInfo.name}
                deviceID={deviceID} />
              { deviceInfo && deviceInfo.securechipModel !== '' && (
                <SettingsItem optionalText={deviceInfo.securechipModel}>
                  {t('deviceSettings.hardware.securechip')}
                </SettingsItem>
              ) }
              {attestation !== null && (
                <SettingsItem
                  optionalText={t(`deviceSettings.hardware.attestation.${attestation}`)}
                  optionalIcon={attestation ? <Checked/> : <Warning/>}>
                  {t('deviceSettings.hardware.attestation.label')}
                </SettingsItem>
              )}
            </Column>
          </Grid>
          <Grid>
            <Column>
              <h3 className="subTitle">{t('deviceSettings.firmware.title')}</h3>
              { versionInfo && versionInfo.canUpgrade ? (
                <UpgradeButton
                  deviceID={deviceID}
                  versionInfo={versionInfo}/>
              ) : versionInfo && (
                <SettingsItem
                  optionalText={versionInfo.currentVersion}
                  optionalIcon={<Checked/>}>
                  {t('deviceSettings.firmware.upToDate')}
                </SettingsItem>
              )}
            </Column>
            <Column>
              <h3 className="subTitle">{t('settings.expert.title')}</h3>
              <SettingsButton onClick={routeToPassphrase}>
                { deviceInfo.mnemonicPassphraseEnabled
                  ? t('passphrase.disable')
                  : t('passphrase.enable')}
              </SettingsButton>
              { versionInfo && versionInfo.canGotoStartupSettings ? (
                <GotoStartupSettings apiPrefix={apiPrefix} />
              ) : null }
            </Column>
          </Grid>
        </ViewContent>
      </View>
      <ManageDeviceGuide />
    </Main>
  );
};
