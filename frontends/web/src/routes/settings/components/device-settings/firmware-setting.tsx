// SPDX-License-Identifier: Apache-2.0

import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '@/contexts/AppContext';
import { VersionInfo, upgradeDeviceFirmware } from '@/api/bitbox02';
import { Dialog, DialogButtons, DialogScrollContent } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { Checked, PointToBitBox02, RedDot } from '@/components/icon';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export type TProps = {
  deviceID: string;
  versionInfo: VersionInfo;
  asButton?: boolean;
  noSidebarOffset?: boolean;
};

const FirmwareSetting = ({
  deviceID,
  versionInfo,
  asButton = false,
  noSidebarOffset,
}: TProps) => {
  const { t } = useTranslation();
  const { setFirmwareUpdateDialogOpen, firmwareUpdateDialogOpen } = useContext(AppContext);
  const [confirming, setConfirming] = useState(false);
  const canUpgrade = versionInfo.canUpgrade;
  const secondaryText = canUpgrade ? t('deviceSettings.firmware.upgradeAvailable') : t('deviceSettings.firmware.upToDate');
  const extraComponent = canUpgrade ? <RedDot width={8} height={8}/> : <Checked />;

  const handleOpenDialog = canUpgrade ? () => setFirmwareUpdateDialogOpen(true) : undefined;

  const handleUpgradeFirmware = async () => {
    setConfirming(true);
    try {
      await upgradeDeviceFirmware(deviceID);
      setFirmwareUpdateDialogOpen(false);
    } finally {
      setConfirming(false);
    }
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
        open={firmwareUpdateDialogOpen && canUpgrade}
        versionInfo={versionInfo}
        confirming={confirming}
        noSidebarOffset={noSidebarOffset}
        onUpgradeFirmware={handleUpgradeFirmware}
        onClose={() => setFirmwareUpdateDialogOpen(false)}
      />
    </>
  );
};

export type TUpgradeDialogProps = {
  open: boolean;
  versionInfo: VersionInfo;
  confirming: boolean;
  noSidebarOffset?: boolean;
  onUpgradeFirmware: () => void;
  onClose: () => void;
};

export const UpgradeDialog = ({
  open,
  versionInfo,
  confirming,
  noSidebarOffset,
  onUpgradeFirmware,
  onClose
}: TUpgradeDialogProps) => {
  const { t } = useTranslation();
  if (!versionInfo.canUpgrade) {
    return null;
  }
  return (
    <Dialog
      noSidebarOffset={noSidebarOffset}
      onClose={confirming ? undefined : onClose}
      open={open}
      title={t('upgradeFirmware.title')}>
      <DialogScrollContent>
        {confirming ? (
          <>
            {t('confirmOnDevice')}
            <PointToBitBox02 />
          </>
        ) : (
          <p>{t('upgradeFirmware.description', {
            currentVersion: versionInfo.currentVersion,
            newVersion: versionInfo.newVersion,
          })}</p>
        )}
      </DialogScrollContent>
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
