// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as bitbox02 from '@/api/bitbox02';
import { useMountedRef } from '@/hooks/mount';
import { alertUser } from '@/components/alert/Alert';
import { Wait } from './wait';
import { ChecklistWalletCreate, ChecklistWalletCreateMnemonic } from './checklist';
import { SetDeviceName, SetDeviceNameWithSDCard } from './name';
import { SetPassword } from './password';
import { WithSDCard } from './sdcard';

type TCreateWalletStatus = 'intro' | 'setName' | 'setPassword' | 'showDisclaimer' | 'createBackup';

type Props = {
  backupType: 'sdcard' | 'mnemonic';
  backupSeedLength: 16 | 32;
  deviceID: string;
  isSeeded: boolean;
  onAbort: () => void;
};

export const CreateWallet = ({
  backupType,
  backupSeedLength,
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
      const result = await bitbox02.setPassword(deviceID, backupSeedLength);
      if (!result.success) {
        if (result.code === bitbox02.errUserAbort) {
          alertUser(t('bitbox02Wizard.stepPassword.e104'), {
            asDialog: false,
            callback: () => onAbort(),
          });
          setErrorText('');
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
        const errorText = result.code === bitbox02.errUserAbort
          ? t('bitbox02Settings.deviceName.error_104')
          : result.message;
        alertUser(errorText || t('genericError'), {
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
      const result = await bitbox02.createBackup(
        deviceID,
        backupType === 'mnemonic' ? 'recovery-words' : 'sdcard',
      );
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
      switch (backupType) {
      case 'sdcard':
        return (
          <WithSDCard onAbort={onAbort} deviceID={deviceID}>
            <ChecklistWalletCreate onContinue={createBackup} />
          </WithSDCard>
        );
      case 'mnemonic':
        return (
          <ChecklistWalletCreateMnemonic onContinue={createBackup} />
        );
      }
    }
    if (status === 'createBackup') {
      switch (backupType) {
      case 'sdcard':
        return (
          <Wait
            title={t('bitbox02Interact.confirmDate')}
            text={t('bitbox02Interact.confirmDateText')} />
        );
      case 'mnemonic':
        return (
          <Wait
            title={t('bitbox02Interact.confirmWords', {
              amount: backupSeedLength === 16 ? '12' : '24'
            })}
            text={t('bitbox02Interact.confirmWordsText')} />
        );
      }
    }
  }

  switch (status) {
  case 'intro':
    switch (backupType) {
    case 'sdcard':
      return (
        <SetDeviceNameWithSDCard
          key="set-devicename-sdcard"
          deviceID={deviceID}
          onDeviceName={setDeviceName}
          onBack={onAbort} />
      );
    case 'mnemonic':
      return (
        <SetDeviceName
          key="set-devicename-mnemonic"
          onDeviceName={setDeviceName}
          onBack={onAbort} />
      );
    }
    break;
  case 'setName':
    return (
      <Wait title={t('bitbox02Interact.confirmName')} />
    );
  case 'setPassword':
    return (
      <SetPassword
        errorText={errorText} />
    );
  default:
    return null;
  }
};
