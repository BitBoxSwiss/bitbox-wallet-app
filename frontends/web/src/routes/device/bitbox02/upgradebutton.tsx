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

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { VersionInfo, upgradeDeviceFirmware } from '../../../api/bitbox02';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { Button } from '../../../components/forms';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { RedDot } from '../../../components/icon/icon';

export type TProps = {
    asButton?: boolean;
    deviceID: string;
    versionInfo?: VersionInfo;
}

export const UpgradeButton = ({ asButton, deviceID, versionInfo }: TProps) => {
  const { t } = useTranslation();

  const [activeDialog, setActiveDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const upgradeFirmware = async () => {
    setConfirming(true);
    await upgradeDeviceFirmware(deviceID);
    setConfirming(false);
    setActiveDialog(false);
  };

  if (!versionInfo || !versionInfo.canUpgrade) {
    return null;
  }

  return (
    <div>
      { asButton ? (
        <Button primary onClick={() => setActiveDialog(true)}>
          {t('button.upgrade')}
          {' '}
        </Button>
      ) : (
        <SettingsButton
          optionalText={versionInfo.newVersion}
          secondaryText={
            <>
              {t('deviceSettings.firmware.upgradeAvailable')}
              {' '}
              <RedDot />
            </>
          }
          onClick={() => setActiveDialog(true)}>
          {t('deviceSettings.firmware.firmwareVersion')}
        </SettingsButton>) }
      <Dialog open={activeDialog} title={t('upgradeFirmware.title')}>
        {confirming ? t('confirmOnDevice') : (
          <p>{t('upgradeFirmware.description', {
            currentVersion: versionInfo.currentVersion,
            newVersion: versionInfo.newVersion,
          })}</p>
        )}
        { !confirming && (
          <DialogButtons>
            <Button
              primary
              onClick={upgradeFirmware}>
              {t('button.upgrade')}
            </Button>
            <Button transparent onClick={() => setActiveDialog(false)}>
              {t('button.back')}
            </Button>
          </DialogButtons>
        )}
      </Dialog>
    </div>
  );
};
