// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  deviceID: string;
};

const ManageBackupSetting = ({ deviceID }: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <SettingsItem
      onClick={() => navigate(`/manage-backups/${deviceID}`)}
      settingName={t('backup.title')}
      secondaryText={t('deviceSettings.backups.manageBackups.description')}
    />
  );
};


export { ManageBackupSetting };