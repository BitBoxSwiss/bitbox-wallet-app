// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { SettingsItem, SettingsValue } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  secureChipModel: string;
};

export const SecureChipSetting = ({ secureChipModel }: TProps) => {
  const { t } = useTranslation();
  return (
    <SettingsItem
      settingName={t('deviceSettings.hardware.securechip')}
      secondaryText={t('deviceSettings.deviceInformation.securechip.description')}
      displayedValue={
        <SettingsValue>{secureChipModel}</SettingsValue>
      }
    />
  );
};
