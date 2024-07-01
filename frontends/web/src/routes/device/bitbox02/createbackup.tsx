/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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
import { checkBackup, createBackup as createBackupAPI } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { confirmation } from '@/components/confirm/Confirm';
import { Button } from '@/components/forms';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { useTranslation } from 'react-i18next';

type TProps = {
    deviceID: string;
}

export const Create = ({ deviceID }: TProps) => {
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const { t } = useTranslation();

  const createBackup = () => {
    setCreatingBackup(true);
    createBackupAPI(deviceID, 'sdcard')
      .then((result) => {
        setCreatingBackup(false);
        setDisabled(false);
        if (!result.success) {
          alertUser(t('backup.create.fail'));
        }
      })
      .catch(console.error);
  };

  const maybeCreateBackup = async () => {
    setDisabled(true);
    try {
      const check = await checkBackup(deviceID, true);
      if (check.success) {
        confirmation(t('backup.create.alreadyExists'), result => {
          if (result) {
            createBackup();
          } else {
            setDisabled(false);
          }
        });
        return;
      }
      createBackup();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <span>
      <Button
        primary
        disabled={disabled}
        onClick={maybeCreateBackup}>
        {t('backup.create.title')}
      </Button>
      { creatingBackup && (
        <WaitDialog title={t('backup.create.title')}>
          {t('bitbox02Interact.followInstructions')}
        </WaitDialog>
      )}
    </span>
  );
};
