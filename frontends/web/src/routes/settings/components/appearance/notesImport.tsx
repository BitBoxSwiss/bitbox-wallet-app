// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { importNotes } from '@/api/backend';
import { alertUser } from '@/components/alert/Alert';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import style from './notesImport.module.css';

export const NotesImport = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDisabled, setImportDisabled] = useState<boolean>(false);

  return (
    <form>
      <input
        type="file"
        className={style.fileInput}
        ref={fileInputRef}
        accept=".jsonl,.txt,text/x-jsonl"
        onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
          setImportDisabled(e.target.files === null || e.target.files.length === 0);
          if (fileInputRef.current === null) {
            return;
          }
          const fileInput = fileInputRef.current;
          if (!fileInput.files || !fileInput.files.length) {
            fileInput.click();
            return;
          }
          try {
            setImportDisabled(true);
            const file = fileInput.files[0];
            if (!file) {
              return;
            }
            if (file.size > 10 * 1024 * 1024) {
              alertUser(t('settings.notes.import.tooLarge'));
              return;
            }

            const result = await importNotes(await file.arrayBuffer());
            if (result.success) {
              const { accountCount, transactionCount } = result.data;
              alertUser(`${t('settings.notes.import.accountNames', {
                count: accountCount
              })}
    ${t('settings.notes.import.transactionNotes', {
      count: transactionCount
    })}`);
              fileInput.value = '';
            } else if (result.message) {
              alertUser(result.message);
            }
            return;
          } finally {
            setImportDisabled(false);
          }
        }}
      />
      <SettingsItem
        disabled={importDisabled}
        settingName={t('settings.notes.import.title')}
        onClick={() => {
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
        secondaryText={t('settings.notes.import.description')}
      />
    </form>
  );
};
