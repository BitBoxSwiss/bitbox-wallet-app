/**
 * Copyright 2024 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
