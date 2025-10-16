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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PointToBitBox02 } from '@/components/icon';
import { bluetoothToggleEnabled, getDeviceInfo } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { StyledSkeleton } from '@/routes/settings/bb02-settings';

type TBluetoothToggleEnabledSettingProps = {
  deviceID: string;
};

type TToggleEnabledWaitDialogProps = {
  show: boolean;
  enabled: boolean;
};

const ToggleEnabledWaitDialog = ({ show, enabled }: TToggleEnabledWaitDialogProps) => {
  const { t } = useTranslation();

  if (!show) {
    return null;
  }

  return (
    <WaitDialog
      title={enabled ? t('bitbox02Settings.bluetoothToggleEnabled.titleEnabled') : t('bitbox02Settings.bluetoothToggleEnabled.titleDisabled')} >
      <p>{t('bitbox02Interact.followInstructions')}</p>
      <PointToBitBox02 />
    </WaitDialog>
  );
};

const BluetoothToggleEnabledSetting = ({ deviceID }: TBluetoothToggleEnabledSettingProps) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [enabled, setEnabled] = useState<undefined | boolean>(undefined);

  const updateEnabled = useCallback(async () => {
    const deviceInfoResult = await getDeviceInfo(deviceID);
    if (!deviceInfoResult.success) {
      console.error(deviceInfoResult.message);
      alertUser(deviceInfoResult.message || t('genericError'));
      return;
    }
    const bluetooth = deviceInfoResult.deviceInfo.bluetooth;
    if (!bluetooth) {
      return;
    }
    setEnabled(bluetooth.enabled);
    return bluetooth.enabled;
  }, [deviceID, t]);

  useEffect(() => {
    updateEnabled();
  }, [updateEnabled]);

  const handleBluetoothToggleEnabled = async () => {
    setShow(true);
    const result = await bluetoothToggleEnabled(deviceID);
    if (!result.success) {
      setShow(false);
      console.error(result.message);
      alertUser(result.message || t('genericError'));
      return;
    }
    setShow(false);
    const enabled = await updateEnabled();
    if (enabled === true) {
      alertUser(t('bitbox02Settings.bluetoothToggleEnabled.alertEnabled'));
    } else if (enabled === false) {
      alertUser(t('bitbox02Settings.bluetoothToggleEnabled.alertDisabled'));
    }
  };
  if (enabled === undefined) {
    return <StyledSkeleton />;
  }
  return (
    <>
      <SettingsItem
        settingName={enabled ? t('bitbox02Settings.bluetoothToggleEnabled.titleEnabled') : t('bitbox02Settings.bluetoothToggleEnabled.titleDisabled')}
        secondaryText={t('bitbox02Settings.bluetoothToggleEnabled.description')}
        onClick={handleBluetoothToggleEnabled}
      />
      <ToggleEnabledWaitDialog show={show} enabled={enabled} />
    </>
  );
};

export { BluetoothToggleEnabledSetting };
