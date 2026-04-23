// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { checkBackup, createBackup as createBackupAPI } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { confirmation } from '@/components/confirm/Confirm';
import { Button } from '@/components/forms';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { useTranslation } from 'react-i18next';

const startedCreateBackupFlows = new Set<string>();

type TProps = {
  deviceID: string;
  autoStart?: boolean;
  autoStartID?: string;
  showButton?: boolean;
};

export const Create = ({
  deviceID,
  autoStart = false,
  autoStartID,
  showButton = true,
}: TProps) => {
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const maybeCreateBackupRef = useRef<() => Promise<void>>();
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
  maybeCreateBackupRef.current = maybeCreateBackup;

  useEffect(() => {
    if (!autoStart) {
      return;
    }
    const id = autoStartID || `create-${deviceID}`;
    if (startedCreateBackupFlows.has(id)) {
      return;
    }
    startedCreateBackupFlows.add(id);
    void maybeCreateBackupRef.current?.();
  }, [autoStart, autoStartID, deviceID]);

  return (
    <>
      {showButton && (
        <Button
          primary
          disabled={disabled}
          onClick={maybeCreateBackup}>
          {t('backup.create.title')}
        </Button>
      )}
      { creatingBackup && (
        <WaitDialog title={t('backup.create.title')}>
          {t('bitbox02Interact.followInstructions')}
        </WaitDialog>
      )}
    </>
  );
};
