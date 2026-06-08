// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  secureChipModel: string;
};

const SecureChipSetting = ({ secureChipModel }: TProps) => {
  const { t } = useTranslation();
  return (
    <SettingsItem
      settingName={t('deviceSettings.hardware.securechip')}
      secondaryText={t('deviceSettings.deviceInformation.securechip.description')}
      displayedValue={secureChipModel}
    />
  );
};

export { SecureChipSetting };