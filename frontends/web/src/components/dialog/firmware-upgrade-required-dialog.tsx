// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { Dialog, DialogButtons } from './dialog';
import { Button } from '@/components/forms';
import { AppContext } from '@/contexts/AppContext';
import { useAppState } from '@/contexts/app-state-context';

type TFirmwareUpgradeRequiredDialogProps = {
  open: boolean;
  onClose: () => void;
};

export const FirmwareUpgradeRequiredDialog = ({ open, onClose }: TFirmwareUpgradeRequiredDialogProps) => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { setFirmwareUpdateDialogOpen } = useContext(AppContext);
  const { deviceIDs, hasDevices } = useAppState();

  const handleUpgrade = useCallback(() => {
    setFirmwareUpdateDialogOpen(true);
    if (deviceIDs && hasDevices) {
      navigate(`/settings/device-settings/${deviceIDs[0] as string}`);
    }
    onClose();
  }, [setFirmwareUpdateDialogOpen, deviceIDs, hasDevices, navigate, onClose]);

  return (
    <Dialog
      title={t('upgradeFirmware.title')}
      open={open}
      onClose={onClose}>
      <p>{t('device.firmwareUpgradeRequired')}</p>
      <DialogButtons>
        <Button primary onClick={handleUpgrade}>
          {t('upgradeFirmware.button')}
        </Button>
        <Button secondary onClick={onClose}>
          {t('dialog.cancel')}
        </Button>
      </DialogButtons>
    </Dialog>
  );
};
