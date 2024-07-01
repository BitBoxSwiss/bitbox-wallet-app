/**
 * Copyright 2023 Shift Crypto AG
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VersionInfo, upgradeDeviceFirmware } from '@/api/bitbox02';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { Checked, RedDot } from '@/components/icon';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export type TProps = {
    deviceID: string;
    versionInfo: VersionInfo;
    asButton?: boolean;
}

export type TUpgradeDialogProps = {
    open: boolean;
    versionInfo: VersionInfo;
    confirming: boolean;
    onUpgradeFirmware: () => void;
    onClose: () => void;
}

const FirmwareSetting = ({ deviceID, versionInfo, asButton = false }: TProps) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const canUpgrade = versionInfo.canUpgrade;
  const secondaryText = canUpgrade ? t('deviceSettings.firmware.upgradeAvailable') : t('deviceSettings.firmware.upToDate');
  const extraComponent = canUpgrade ? <RedDot width={8} height={8}/> : <Checked />;

  const handleOpenDialog = canUpgrade ? () => setDialogOpen(true) : undefined;

  const handleUpgradeFirmware = async () => {
    setConfirming(true);
    await upgradeDeviceFirmware(deviceID);
    setConfirming(false);
    setDialogOpen(false);
  };

  return (
    <>
      { asButton ? (
        <Button
          onClick={handleOpenDialog}
          primary>
          {t('button.upgrade')}
        </Button>
      ) : (
        <SettingsItem
          settingName={t('deviceSettings.firmware.title')}
          secondaryText={secondaryText}
          onClick={handleOpenDialog}
          displayedValue={versionInfo.currentVersion}
          extraComponent={extraComponent}
        />
      )}
      <UpgradeDialog
        open={dialogOpen && canUpgrade}
        versionInfo={versionInfo}
        confirming={confirming}
        onUpgradeFirmware={handleUpgradeFirmware}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
};

const UpgradeDialog = ({
  open,
  versionInfo,
  confirming,
  onUpgradeFirmware,
  onClose
}: TUpgradeDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog onClose={onClose} open={open} title={t('upgradeFirmware.title')}>
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
            onClick={onUpgradeFirmware}>
            {t('button.upgrade')}
          </Button>
          <Button secondary onClick={onClose}>
            {t('button.back')}
          </Button>
        </DialogButtons>
      )}
    </Dialog>
  );
};

export { FirmwareSetting };