/**
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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { restoreFromMnemonic } from '../../../../api/bitbox02';
import { alertUser } from '../../../../components/alert/Alert';
import { Backup } from '../../components/backup';
import { SetPasswordWithBackup } from './password';
import { RestoreFromSDCardBackup } from './restore';
import { WithSDCard } from './sdcard';
import { Wait } from './wait';

type Props = {
  deviceID: string;
  onAbort: () => void;
};

export const RestoreFromSDCard = ({
  deviceID,
  onAbort,
}: Props) => {
  const [status, setStatus] = useState<'restore' | 'setPassword'>('restore');
  const [backup, setBackup] = useState<Backup>();

  const onSelectBackup = (backup: Backup) => {
    setStatus('setPassword');
    setBackup(backup);
  };

  const onRestoreBackup = (success: boolean) => {
    if (!success) {
      onAbort();
      return;
    }
    setBackup(undefined);
  };

  switch (status) {
  case 'restore':
    return (
      <WithSDCard deviceID={deviceID}>
        <RestoreFromSDCardBackup
          deviceID={deviceID}
          onSelectBackup={onSelectBackup}
          onRestoreBackup={onRestoreBackup}
          onBack={onAbort} />
      </WithSDCard>
    );
  case 'setPassword':
    return (
      <SetPasswordWithBackup forBackup={backup} />
    );
  }
};

export const RestoreFromMnemonic = ({
  deviceID,
  onAbort,
}: Props) => {
  const { t } = useTranslation();

  useEffect(() => {
    restoreFromMnemonic(deviceID)
      .then(result => {
        if (!result.success) {
          alertUser(t('bitbox02Wizard.restoreFromMnemonic.failed'), {
            asDialog: false,
            callback: () => onAbort(),
          });
        }
      })
      .catch(console.error);
  }, [deviceID, onAbort, t]);

  return (
    <Wait
      title={t('bitbox02Interact.followInstructionsMnemonicTitle')}
      text={t('bitbox02Interact.followInstructionsMnemonic')} />
  );
};