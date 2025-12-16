// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Checked, RedDot } from '@/components/icon';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export type TProps = {
  firmwareVersion: string;
};

export const BluetoothFirmwareSetting = ({ firmwareVersion }: TProps) => {
  const { t } = useTranslation();

  // So far there is only one BLE firmware version. This can be adjusted once there is an upgrade
  // available.
  const canUpgrade = false;
  const secondaryText = canUpgrade ? t('deviceSettings.firmware.upgradeAvailable') : t('deviceSettings.firmware.upToDate');
  const extraComponent = canUpgrade ? <RedDot width={8} height={8}/> : <Checked />;

  return (
    <>
      <SettingsItem
        settingName={t('deviceSettings.bluetoothFirmware.title')}
        secondaryText={secondaryText}
        displayedValue={firmwareVersion}
        extraComponent={extraComponent}
      />
    </>
  );
};
