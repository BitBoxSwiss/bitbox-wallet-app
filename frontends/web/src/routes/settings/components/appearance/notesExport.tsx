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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportNotes } from '@/api/backend';
import { alertUser } from '@/components/alert/Alert';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export const NotesExport = () => {
  const { t } = useTranslation();
  const [disabled, setDisabled] = useState<boolean>(false);

  return (
    <SettingsItem
      disabled={disabled}
      settingName={t('settings.notes.export.title')}
      onClick={async () => {
        try {
          setDisabled(true);

          const result = await exportNotes();
          if (result.success) {
            alertUser(t('settings.notes.export.success'));
          } else if (!result.aborted && result.message) {
            alertUser(result.message);
          }
        } finally {
          setDisabled(false);
        }
      }}
      secondaryText={t('settings.notes.export.description')}
    />
  );
};
