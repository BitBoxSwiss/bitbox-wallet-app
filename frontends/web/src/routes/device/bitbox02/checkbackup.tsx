// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import * as bitbox02API from '@/api/bitbox02';
import { BackupsListItem } from '@/routes/device/components/backup';
import { Backup, getBackupList } from '@/api/backup';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { useTranslation } from 'react-i18next';

const startedCheckBackupFlows = new Set<string>();

type TProps = {
  deviceID: string;
  backups: Backup[];
  disabled: boolean;
  autoStart?: boolean;
  autoStartID?: string;
  showButton?: boolean;
};

export const Check = ({
  deviceID,
  backups,
  disabled,
  autoStart = false,
  autoStartID,
  showButton = true,
}: TProps) => {
  const [activeDialog, setActiveDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [foundBackup, setFoundBackup] = useState<Backup>();
  const [userVerified, setUserVerified] = useState(false);
  const checkBackupRef = useRef<() => Promise<void>>();
  const { t } = useTranslation();

  const checkBackup = async () => {
    setMessage('');
    setFoundBackup(undefined);
    setUserVerified(false);
    try {
      const result = await bitbox02API.checkBackup(deviceID, true);
      if (result.success) {
        const { backupID } = result;
        let foundBackup = backups.find((backup: Backup) => backup.id === backupID);
        if (!foundBackup) {
          const backupListResult = await getBackupList(deviceID);
          if (backupListResult.success) {
            foundBackup = backupListResult.backups.find((backup: Backup) => backup.id === backupID);
          }
        }
        setActiveDialog(true);
        setFoundBackup(foundBackup);
      }
      const check = await bitbox02API.checkBackup(deviceID, false);
      if (!check.success) {
        setActiveDialog(true);
        if (check.code === bitbox02API.errUserAbort) {
          setMessage(t('backup.check.aborted'));
          setFoundBackup(undefined);
        } else {
          setMessage(t('backup.check.notOK'));
        }
        setUserVerified(true);
        return;
      }
      setMessage(t('backup.check.success'));
      setUserVerified(true);
    } catch (error) {
      console.error(error);
    }
  };
  checkBackupRef.current = checkBackup;

  useEffect(() => {
    if (!autoStart || disabled) {
      return;
    }
    const id = autoStartID || `check-${deviceID}`;
    if (startedCheckBackupFlows.has(id)) {
      return;
    }
    startedCheckBackupFlows.add(id);
    void checkBackupRef.current?.();
  }, [autoStart, disabled, autoStartID, deviceID]);

  return (
    <>
      {showButton && (
        <Button
          primary
          disabled={disabled}
          onClick={checkBackup}>
          {t('button.check')}
        </Button>
      )}
      <Dialog
        open={activeDialog}
        title={t('backup.check.confirmTitle')}>
        <form onSubmit={(e) => {
          e.preventDefault();
          setActiveDialog(false);
          setUserVerified(false);
        }}>
          {message && (
            <p>{message}</p>
          )}
          { foundBackup !== undefined && (
            <BackupsListItem
              backup={foundBackup}
              radio={false} />
          )}
          <DialogButtons>
            {userVerified && (
              <Button
                autoFocus
                primary
                type="submit">
                {t('button.ok')}
              </Button>
            )}
          </DialogButtons>
        </form>
      </Dialog>
    </>
  );
};
