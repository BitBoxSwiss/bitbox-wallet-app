// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { checkBackup, createBackup as createBackupAPI } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { confirmation } from '@/components/confirm/Confirm';
import { Button } from '@/components/forms';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { useTranslation } from 'react-i18next';

type TProps = {
  deviceID: string;
};

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
    <>
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
    </>
  );
};
