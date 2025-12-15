// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { SettingsItem, SettingsValue } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  rootFingerprint: string;
};

const RootFingerprintSetting = ({ rootFingerprint }: TProps) => {
  const { t } = useTranslation();
  return (
    <SettingsItem
      settingName={'Root fingerprint'}
      secondaryText={t('deviceSettings.deviceInformation.rootFingerprint.description')}
      displayedValue={
        <SettingsValue>{rootFingerprint}</SettingsValue>
      }
    />
  );
};

export { RootFingerprintSetting };
