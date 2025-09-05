
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

import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSync } from '@/hooks/api';
import { restoreBackup } from '@/api/bitbox02';
import { getBackupList, subscribeBackupList } from '@/api/backup';
import { Toast } from '@/components/toast/toast';
import { BackupsListItem } from '@/routes/device/components/backup';
import { Backup } from '@/api/backup';
import { Button } from '@/components/forms';
import { Check } from './checkbackup';
import { Create } from './createbackup';
import { HorizontallyCenteredSpinner } from '@/components/spinner/SpinnerAnimation';
import backupStyle from '@/routes/device/components/backups.module.css';

type TProps = {
    deviceID: string;
    showRestore?: boolean;
    showCreate?: boolean;
    showRadio: boolean;
    onSelectBackup?: (backup: Backup) => void;
    onRestoreBackup?: (success: boolean) => void;
    children?: ReactNode;
}

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
      .then(({ success }) => {
        setRestoring(false);
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
