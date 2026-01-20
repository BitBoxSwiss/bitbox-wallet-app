// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PointToBitBox02 } from '@/components/icon';
import { bluetoothToggleEnabled, errUserAbort, getDeviceInfo } from '@/api/bitbox02';
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
      if (result.code === errUserAbort) {
        // User canceled on the device
        alertUser(t('bitbox02Settings.bluetoothToggleEnabled.error_104'));
      } else {
        console.error(result.message);
        alertUser(result.message || t('genericError'));
      }
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
