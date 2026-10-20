// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { SettingsItem, SettingsValue } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  deviceID: string;
  passphraseEnabled: boolean;
};

export const PassphraseSetting = ({ deviceID, passphraseEnabled }: TProps) => {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const displayedValue = (
    passphraseEnabled
      ? t('generic.enabled_true')
      : t('generic.enabled_false')
  );

  return (
    <SettingsItem
      onClick={() => navigate(`/settings/device-settings/passphrase/${deviceID}`)}
      settingName={t('deviceSettings.expert.passphrase.title')}
      secondaryText={t('deviceSettings.expert.passphrase.description')}
      displayedValue={
        <SettingsValue>{displayedValue}</SettingsValue>
      }
    />
  );
};
