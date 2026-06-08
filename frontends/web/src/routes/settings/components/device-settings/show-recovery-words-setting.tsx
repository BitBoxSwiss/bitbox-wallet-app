// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  deviceID: string;
};

export const ShowRecoveryWordsSetting = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <SettingsItem
      settingName={t('backup.showMnemonic.title')}
      secondaryText={t('deviceSettings.backups.showRecoveryWords.description')}
      onClick={() => navigate(`/settings/device-settings/recovery-words/${deviceID}`)}
    />
  );
};
