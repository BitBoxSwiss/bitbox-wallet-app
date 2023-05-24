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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as bitbox02 from '../../../../api/bitbox02';
import { useMountedRef } from '../../../../hooks/mount';
import { alertUser } from '../../../../components/alert/Alert';
import { Wait } from './wait';
import { ChecklistWalletCreate } from './checklist';
import { SetDeviceName } from './name';
import { SetPassword } from './password';
import { WithSDCard } from './sdcard';

type TCreateWalletStatus = 'intro' | 'setName' | 'setPassword' | 'showDisclaimer' | 'createBackup';

type Props = {
  deviceID: string;
  isSeeded: boolean;
  onAbort: () => void;
};

export const CreateWallet = ({
  deviceID,
  isSeeded,
  onAbort,
}: Props) => {
  const { t } = useTranslation();
  const isMounted = useMountedRef();
  const [status, setStatus] = useState<TCreateWalletStatus>('intro');
  const [errorText, setErrorText] = useState('');

  const ensurePassword = async () => {
    setStatus('setPassword');
    try {
      const result = await bitbox02.setPassword(deviceID, 32);
      if (!result.success) {
        if (result.code === bitbox02.errUserAbort) {
          // On user abort, just go back to the first screen. This is a bit lazy, as we should show
          // a screen to ask the user to go back or try again.
          setErrorText('');
          onAbort();
        } else {
          setErrorText(t('bitbox02Wizard.noPasswordMatch'));
          if (isMounted.current) {
            ensurePassword();
          }
        }
        // show error and do NOT continue to createBackup
        return;
      }
      setErrorText('');
      setStatus('showDisclaimer');
    } catch (error) {
      console.error(error);
    }
  };

  const setDeviceName = async (deviceName: string) => {
    setStatus('setName');
    try {
      const result = await bitbox02.setDeviceName(deviceID, deviceName);
      if (!result.success) {
        alertUser(result.message || t('genericError'), {
          asDialog: false,
          callback: () => onAbort(),
        });
        return;
      }
      ensurePassword();
    } catch (error) {
      console.error(error);
    }
  };

  const createBackup = async () => {
    setStatus('createBackup');
    try {
      const result = await bitbox02.createBackup(deviceID, 'sdcard');
      if (!result.success) {
        if (result.code === bitbox02.errUserAbort) {
          alertUser(t('bitbox02Wizard.createBackupAborted'), {
            asDialog: false,
            callback: () => onAbort(),
          });
        } else {
          alertUser(t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (isSeeded) {
    if (status === 'showDisclaimer') {
      return (
        <WithSDCard deviceID={deviceID}>
          <ChecklistWalletCreate key="create-backup" onContinue={createBackup} />
        </WithSDCard>
      );
    }
    if (status === 'createBackup') {
      return (
        <Wait
          title={t('bitbox02Interact.confirmDate')}
          text={t('bitbox02Interact.confirmDateText')} />
      );
    }
  }

  switch (status) {
  case 'intro':
    return (
      <SetDeviceName
        key="set-devicename"
        deviceID={deviceID}
        onDeviceName={setDeviceName}
        onBack={onAbort} />
    );
  case 'setName':
    return (
      <Wait title={t('bitbox02Interact.confirmName')} />
    );
  case 'setPassword':
    return (
      <SetPassword key="create-wallet" errorText={errorText} />
    );
  default:
    return null;
  }
};
