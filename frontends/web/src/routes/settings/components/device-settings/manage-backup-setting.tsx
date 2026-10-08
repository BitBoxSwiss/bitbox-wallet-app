// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  deviceID: string;
};

export const ManageBackupSetting = ({ deviceID }: TProps) => {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  return (
    <SettingsItem
      onClick={() => navigate(`/manage-backups/${deviceID}`)}
      settingName={t('backup.title')}
      secondaryText={t('deviceSettings.backups.manageBackups.description')}
    />
  );
};
