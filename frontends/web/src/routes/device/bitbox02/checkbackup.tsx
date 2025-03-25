/**
 * Copyright 2018 Shift Devices AG
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
import * as bitbox02API from '@/api/bitbox02';
import { BackupsListItem } from '@/routes/device/components/backup';
import { Backup } from '@/api/backup';
import { alertUser } from '@/components/alert/Alert';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { useTranslation } from 'react-i18next';

type TProps = {
  deviceID: string;
  backups: Backup[];
  disabled: boolean;
};

export const Check = ({ deviceID, backups, disabled }: TProps) => {
  const [activeDialog, setActiveDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [foundBackup, setFoundBackup] = useState<Backup>();
  const [userVerified, setUserVerified] = useState(false);
  const { t } = useTranslation();

  const checkBackup = async () => {
    setMessage(t('backup.check.confirmTitle'));
    try {
      const result = await bitbox02API.checkBackup(deviceID, true);
      if (result.success) {
        const { backupID } = result;
        const foundBackup = backups.find(
          (backup: Backup) => backup.id === backupID,
        );
        if (!foundBackup) {
          alertUser(t('unknownError', { errorMessage: 'Not found' }));
          return;
        }
        setActiveDialog(true);
        setFoundBackup(foundBackup);
      }
      const check = await bitbox02API.checkBackup(deviceID, false);
      if (!check.success) {
        setActiveDialog(true);
        setMessage(t('backup.check.notOK'));
        setUserVerified(true);
        return;
      }
      setMessage(t('backup.check.success'));
      setUserVerified(true);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <Button primary disabled={disabled} onClick={checkBackup}>
        {t('button.check')}
      </Button>
      <Dialog open={activeDialog} title={message}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActiveDialog(false);
            setUserVerified(false);
          }}
        >
          {foundBackup !== undefined && (
            <BackupsListItem backup={foundBackup} radio={false} />
          )}
          <DialogButtons>
            {userVerified && (
              <Button autoFocus disabled={!userVerified} primary type="submit">
                {userVerified ? t('button.ok') : t('accountInfo.verify')}
              </Button>
            )}
          </DialogButtons>
        </form>
      </Dialog>
    </div>
  );
};
