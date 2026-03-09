// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

type TProps = {
  deviceID: string;
  onClick?: () => void;
};

type TBackupMode = 'create' | 'check' | 'list';

type TBackupSettingsItemProps = TProps & {
  mode: TBackupMode;
  settingName: string;
  secondaryText: string;
};

const BackupSettingsItem = ({
  deviceID,
  onClick,
  mode,
  settingName,
  secondaryText,
}: TBackupSettingsItemProps) => {
  const navigate = useNavigate();

  return (
    <SettingsItem
      onClick={onClick || (() => navigate(`/manage-backups/${deviceID}?mode=${mode}`))}
      settingName={settingName}
      secondaryText={secondaryText}
    />
  );
};

const CreateBackupSetting = ({ deviceID, onClick }: TProps) => {
  const { t } = useTranslation();
  return (
    <BackupSettingsItem
      deviceID={deviceID}
      onClick={onClick}
      mode="create"
      settingName={t('backup.create.title')}
      secondaryText={t('deviceSettings.backups.createBackup.description', {
        defaultValue: 'Create a new microSD card backup.',
      })}
    />
  );
};

const CheckBackupSetting = ({ deviceID, onClick }: TProps) => {
  const { t } = useTranslation();
  return (
    <BackupSettingsItem
      deviceID={deviceID}
      onClick={onClick}
      mode="check"
      settingName={t('backup.check.title')}
      secondaryText={t('deviceSettings.backups.checkBackup.description', {
        defaultValue: 'Verify that your microSD card backup matches this wallet.',
      })}
    />
  );
};

const ListBackupsSetting = ({ deviceID, onClick }: TProps) => {
  const { t } = useTranslation();
  return (
    <BackupSettingsItem
      deviceID={deviceID}
      onClick={onClick}
      mode="list"
      settingName={t('deviceSettings.backups.listBackups.title', { defaultValue: 'List backups' })}
      secondaryText={t('deviceSettings.backups.listBackups.description', {
        defaultValue: 'View the backups on the inserted microSD card.',
      })}
    />
  );
};

export { CreateBackupSetting, CheckBackupSetting, ListBackupsSetting };
