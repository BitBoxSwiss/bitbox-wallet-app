// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  deviceID: string;
  passphraseEnabled: boolean;
};

const PassphraseSetting = ({ deviceID, passphraseEnabled }: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <SettingsItem
      onClick={() => navigate(`/settings/device-settings/passphrase/${deviceID}`)}
      settingName={t('deviceSettings.expert.passphrase.title')}
      secondaryText={t('deviceSettings.expert.passphrase.description')}
      displayedValue={ passphraseEnabled
        ? t('generic.enabled_true')
        : t('generic.enabled_false')}
    />
  );
};

export { PassphraseSetting };