/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2025 Shift Crypto AG
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

import { useState, ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/components/forms';
import { PasswordInput } from '@/components/password';
import { alertUser } from '@/components/alert/Alert';
import { apiPost } from '@/utils/request';
import { DialogLegacy, DialogButtons } from '@/components/dialog/dialog-legacy';

type Props = {
  deviceID: string;
  onCreate: () => void;
}

export const Create = ({ deviceID, onCreate }: Props) => {
  const { t } = useTranslation();

  const [waiting, setWaiting] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [activeDialog, setActiveDialog] = useState(false);

  const abort = () => {
    setWaiting(false);
    setBackupName('');
    setRecoveryPassword('');
    setActiveDialog(false);
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    if (id === 'backupName') setBackupName(value);
    if (id === 'recoveryPassword') setRecoveryPassword(value);
  };

  const validate = () => {
    return !waiting && backupName.trim() !== '';
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setWaiting(true);
    try {
      const data = await apiPost(`devices/${deviceID}/backups/create`, {
        backupName,
        recoveryPassword,
      });

      abort();

      if (!data.success) {
        alertUser(data.errorMessage);
      } else {
        onCreate();
        if (!data.verification) {
          alertUser(t('backup.create.verificationFailed'));
        }
      }
    } catch (error) {
      abort();
      alertUser(String(error));
    }
  };

  return (
    <div>
      <Button primary onClick={() => setActiveDialog(true)}>
        {t('button.create')}
      </Button>

      {activeDialog && (
        <DialogLegacy title={t('backup.create.title')} onClose={abort}>
          <form onSubmit={create}>
            <Input
              autoFocus
              id="backupName"
              label={t('backup.create.name.label')}
              placeholder={t('backup.create.name.placeholder')}
              onInput={handleFormChange}
              value={backupName}
            />
            <p>{t('backup.create.info')}</p>
            <PasswordInput
              id="recoveryPassword"
              label={t('backup.create.password.label')}
              placeholder={t('backup.create.password.placeholder')}
              onInput={handleFormChange}
              value={recoveryPassword}
            />
            <DialogButtons>
              <Button type="submit" primary disabled={waiting || !validate()}>
                {t('button.create')}
              </Button>
              <Button secondary onClick={abort}>
                {t('button.abort')}
              </Button>
            </DialogButtons>
          </form>
        </DialogLegacy>
      )}
    </div>
  );
};
