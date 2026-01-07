// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  passwordStretchingAlgo: string;
};

const PasswordStretchingAlgoSetting = ({ passwordStretchingAlgo }: TProps) => {
  const { t } = useTranslation();
  return (
    <SettingsItem
      settingName={t('deviceSettings.deviceInformation.passwordStretchingAlgo.title')}
      secondaryText={t('deviceSettings.deviceInformation.passwordStretchingAlgo.description')}
      displayedValue={passwordStretchingAlgo}
    />
  );
};

export { PasswordStretchingAlgoSetting };
