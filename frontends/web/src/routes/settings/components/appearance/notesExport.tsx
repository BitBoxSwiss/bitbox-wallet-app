// SPDX-License-Identifier: Apache-2.0

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
