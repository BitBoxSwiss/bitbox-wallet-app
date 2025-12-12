// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { debug } from '@/utils/env';
import { alertUser } from '@/components/alert/Alert';
import { exportLogs } from '@/api/backend';

export const ExportLogSetting = () => {
  const { t } = useTranslation();
  return debug === true ? null : (
    <SettingsItem
      settingName={t('settings.expert.exportLogs.title')}
      onClick={async () => {
        try {
          const result = await exportLogs();
          if (result !== null && !result.success) {
            alertUser(result.errorMessage || t('genericError'));
          }
        } catch (err) {
          console.error(err);
        }
      }}
      secondaryText={t('settings.expert.exportLogs.description')}
    />
  );
};
