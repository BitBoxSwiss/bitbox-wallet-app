// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSync } from '@/hooks/api';
import { restoreBackup, errUserAbort } from '@/api/bitbox02';
import { getBackupList, subscribeBackupList } from '@/api/backup';
import { Toast } from '@/components/toast/toast';
import { BackupsListItem } from '@/routes/device/components/backup';
import { Backup } from '@/api/backup';
import { Button } from '@/components/forms';
import { Check } from './checkbackup';
import { Create } from './createbackup';
import { HorizontallyCenteredSpinner } from '@/components/spinner/SpinnerAnimation';
import { alertUser } from '@/components/alert/Alert';
import backupStyle from '@/routes/device/components/backups.module.css';

type TProps = {
  deviceID: string;
  showRestore?: boolean;
  showCreate?: boolean;
  showRadio: boolean;
  onSelectBackup?: (backup: Backup) => void;
  onRestoreBackup?: (success: boolean) => void;
  children?: ReactNode;
};

export const BackupsV2 = ({
  deviceID,
  showRestore,
  showCreate,
  showRadio,
  onSelectBackup,
  onRestoreBackup,
  children
}: TProps) => {
  const { t } = useTranslation();
  const [selectedBackup, setSelectedBackup] = useState<string>();
  const [restoring, setRestoring] = useState(false);
  const [errorText, setErrorText] = useState('');

  const backups = useSync(() => getBackupList(deviceID), subscribeBackupList(deviceID));
  const hasBackups = backups && backups.success && backups !== undefined;
  const hasMoreThanOneBackups = hasBackups && backups.backups.length > 1;

  useEffect(() => {
    if (!hasBackups || backups.backups.length === 0) {
      return;
    }

    if (backups.backups.length === 1) {
      setSelectedBackup(backups.backups[0]?.id);
    }

  }, [backups, hasBackups]);

  const restore = () => {
    if (!hasBackups) {
      return;
    }
    if (!selectedBackup) {
      return;
    }
    const backup = backups.backups.find(b => b.id === selectedBackup);
    if (!backup) {
      return;
    }
    setRestoring(true);
    onSelectBackup && onSelectBackup(backup);
    restoreBackup(deviceID, selectedBackup)
      .then((result) => {
        const success = result.success;
        setRestoring(false);

        // Show a clear message if the user aborted on the device
        if (!success && result.code === errUserAbort) {
          alertUser(t('backup.restore.error.e104'));
        }

        setErrorText(success ? '' : t('backup.restore.error.general'));

        if (onRestoreBackup) {
          onRestoreBackup(success);
        }
      });
  };

  if (!hasBackups) {
    if (hasBackups === undefined) {
      return <HorizontallyCenteredSpinner />;
    }
    return <div>Error fetching backups</div>;
  }

  return (
    <div>
      <div className={backupStyle.stepContext}>
        {
          errorText && (
            <Toast theme="warning">
              {errorText}
            </Toast>
          )
        }
        {showRadio && hasMoreThanOneBackups ? <p className="m-none m-bottom-large">{t('backup.restore.subtitle')}</p> : null}
        <div className={backupStyle.backupsList}>
          {
            backups.backups.length ? (
              <div className={backupStyle.listContainer}>
                {
                  backups.backups.map(backup => (
                    <div key={backup.id} className={backupStyle.item}>
                      <BackupsListItem
                        disabled={restoring}
                        backup={backup}
                        selectedBackup={selectedBackup}
                        handleChange={(b => setSelectedBackup(b))}
                        onFocus={() => undefined}
                        radio={showRadio} />
                    </div>
                  ))
                }
              </div>
            ) : (
              <p className="text-center">{t('backup.noBackups')}</p>
            )
          }
        </div>
        <div className={backupStyle.backupButtons}>
          {
            showRestore && (
              <Button
                primary={true}
                disabled={!selectedBackup || restoring}
                onClick={restore}>
                {t('button.restore')}
              </Button>
            )
          }
          {
            showCreate && (
              <Create deviceID={deviceID} />
            )
          }
          {
            showCreate && (
              <Check
                deviceID={deviceID}
                backups={backups.backups ? backups.backups : []}
                disabled={backups.backups.length === 0}
              />
            )
          }
          {children}
        </div>
      </div>
    </div>
  );
};
