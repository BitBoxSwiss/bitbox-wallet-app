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
import * as bitbox02 from '../../../../api/bitbox02';
import { alertUser } from '../../../../components/alert/Alert';
import { Wait } from './wait';
import { ChecklistWalletCreate } from './checklist';
import { SetDeviceName } from './name';
import { SetPassword } from './password';

type TCreateWalletStatus = 'intro' | 'setPassword' | 'createBackup';

type TWait = {
  title: string;
  text?: string;
};

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
  const [status, setStatus] = useState<TCreateWalletStatus>('intro');
  const [errorText, setErrorText] = useState('');
  const [waitView, setWaitView] = useState<TWait>();
  const [hasSDCard, setSDCard] = useState<boolean>();

  useEffect(() => {
    bitbox02.checkSDCard(deviceID).then(setSDCard);
  }, [deviceID]);

  const ensurePassword = async () => {
    setStatus('setPassword');
    try {
      const result = await bitbox02.setPassword(deviceID);
      if (!result.success) {
        if (result.code === bitbox02.errUserAbort) {
          // On user abort, just go back to the first screen. This is a bit lazy, as we should show
          // a screen to ask the user to go back or try again.
          setErrorText('');
          onAbort();
        } else {
          setErrorText(t('bitbox02Wizard.noPasswordMatch'));
          ensurePassword();
        }
        // show error and do NOT continue to createBackup
        return;
      }
      setErrorText('');
      setStatus('createBackup');
    } catch (error) {
      console.error(error);
    }
  };

  const setDeviceName = async (deviceName: string) => {
    setWaitView({ title: t('bitbox02Interact.confirmName') });
    try {
      const result = await bitbox02.setDeviceName(deviceID, deviceName);
      if (!result.success) {
        alertUser(result.message || t('genericError'), {
          asDialog: false,
          callback: () => setWaitView(undefined),
        });
        return;
      }
      setWaitView(undefined);
      ensurePassword();
    } catch (error) {
      console.error(error);
    }
  };

  const ensureSDCard = async () => {
    try {
      const sdCardInserted = await bitbox02.checkSDCard(deviceID);
      if (sdCardInserted) {
        return true;
      }
      setWaitView({
        title: t('bitbox02Wizard.stepInsertSD.insertSDcardTitle'),
        text: t('bitbox02Wizard.stepInsertSD.insertSDCard'),
      });
      const result = await bitbox02.insertSDCard(deviceID);
      setWaitView(undefined);
      if (result.success) {
        return true;
      }
      if (result.message) {
        alertUser(result.message, { asDialog: false });
      }
      return false;
    } catch (error) {
      console.error(error);
    }
  };

  const createBackup = async () => {
    try {
      const result1 = await ensureSDCard();
      if (!result1) {
        alertUser(t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
        return;
      }
      setWaitView({
        title: t('bitbox02Interact.confirmDate'),
        text: t('bitbox02Interact.confirmDateText'),
      });
      const result2 = await bitbox02.createBackup(deviceID, 'sdcard');
      if (!result2.success) {
        if (result2.code === bitbox02.errUserAbort) {
          alertUser(t('bitbox02Wizard.createBackupAborted'), { asDialog: false });
        } else {
          alertUser(t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
        }
      }
      setWaitView(undefined);
    } catch (error) {
      console.error(error);
    }
  };

  if (waitView) {
    return (
      <Wait
        key="wait-view"
        title={waitView.title}
        text={waitView.text} />
    );
  }

  if (status === 'createBackup' && isSeeded) {
    return (
      <ChecklistWalletCreate key="create-backup" onContinue={createBackup} />
    );
  }

  switch (status) {
  case 'intro':
    return (
      <SetDeviceName
        key="set-devicename"
        sdCardInserted={hasSDCard}
        onDeviceName={setDeviceName}
        onBack={onAbort} />
    );
  case 'setPassword':
    return (
      <SetPassword key="create-wallet" errorText={errorText} />
    );
  default:
    return null;
  }
};
