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

import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { DialogLegacy, DialogButtons } from '@/components/dialog/dialog-legacy';
import { PasswordSingleInput } from '@/components/password';
import { apiPost } from '@/utils/request';

type Props = {
  deviceID: string;
  selectedBackup?: string;
};

export const Check = ({ deviceID, selectedBackup }: Props) => {
  const { t } = useTranslation();

  const [password, setPassword] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const abort = () => {
    setPassword(null);
    setActiveDialog(false);
    setMessage(null);
  };

  const validate = () => {
    return Boolean(selectedBackup && password);
  };

  const handleCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setMessage(t('backup.check.checking'));

    try {
      const { success, matches, errorMessage } = await apiPost(
        `devices/${deviceID}/backups/check`,
        {
          password,
          filename: selectedBackup,
        }
      );

      if (success) {
        setMessage(matches ? t('backup.check.ok') : t('backup.check.notOK'));
      } else if (errorMessage) {
        setMessage(errorMessage);
      } else {
        setMessage(t('backup.check.error'));
      }
    } catch (err) {
      setMessage(String(err));
    }
  };

  const handleValidPassword = (pwd: string | null) => {
    setPassword(pwd);
  };

  return (
    <div>
      <Button
        secondary
        disabled={!selectedBackup}
        onClick={() => setActiveDialog(true)}
      >
        {t('button.check')}
      </Button>

      {activeDialog && (
        <DialogLegacy title={t('backup.check.title')} onClose={abort}>
          {message ? (
            <div>
              <p style={{ minHeight: '3rem' }}>{message}</p>
              <DialogButtons>
                <Button secondary onClick={abort}>
                  {t('button.back')}
                </Button>
              </DialogButtons>
            </div>
          ) : (
            <form onSubmit={handleCheck}>
              <PasswordSingleInput
                label={t('backup.check.password.label')}
                placeholder={t('backup.check.password.placeholder')}
                showLabel={t('backup.check.password.showLabel')}
                onValidPassword={handleValidPassword}
              />
              <DialogButtons>
                <Button type="submit" primary disabled={!validate()}>
                  {t('button.check')}
                </Button>
                <Button secondary onClick={abort}>
                  {t('button.back')}
                </Button>
              </DialogButtons>
            </form>
          )}
        </DialogLegacy>
      )}
    </div>
  );
};
