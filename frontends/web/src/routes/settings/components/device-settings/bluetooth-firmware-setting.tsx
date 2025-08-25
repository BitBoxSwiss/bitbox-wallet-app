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

import { useTranslation } from 'react-i18next';
import { Checked, RedDot } from '@/components/icon';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export type TProps = {
  firmwareVersion: string;
}

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
        settingName={t('deviceSettings.firmware.title')}
        secondaryText={secondaryText}
        displayedValue={firmwareVersion}
        extraComponent={extraComponent}
      />
    </>
  );
};
