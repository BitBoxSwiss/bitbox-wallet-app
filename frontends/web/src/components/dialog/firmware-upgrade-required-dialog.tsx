// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogButtons } from './dialog';
import { getDeviceList } from '@/api/devices';
import { syncDeviceList } from '@/api/devicessync';
import { useSync } from '@/hooks/api';
import { useDefault } from '@/hooks/default';
import { Button } from '@/components/forms';
import { AppContext } from '@/contexts/AppContext';

type TFirmwareUpgradeRequiredDialogProps = {
  open: boolean;
  onClose: () => void;
};

export const FirmwareUpgradeRequiredDialog = ({ open, onClose }: TFirmwareUpgradeRequiredDialogProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setFirmwareUpdateDialogOpen } = useContext(AppContext);
  const devices = useDefault(useSync(getDeviceList, syncDeviceList), {});
  const deviceIDs = Object.keys(devices);

  const handleUpgrade = useCallback(() => {
    setFirmwareUpdateDialogOpen(true);
    if (deviceIDs && deviceIDs.length > 0) {
      navigate(`/settings/device-settings/${deviceIDs[0] as string}`);
    }
    onClose();
  }, [setFirmwareUpdateDialogOpen, deviceIDs, navigate, onClose]);

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
