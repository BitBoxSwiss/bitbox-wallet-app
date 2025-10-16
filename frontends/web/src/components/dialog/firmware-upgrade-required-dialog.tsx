/**
 * Copyright 2025 Shift Crypto AG
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
