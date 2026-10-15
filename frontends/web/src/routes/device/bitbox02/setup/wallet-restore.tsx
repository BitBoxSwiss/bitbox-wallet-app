// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as bitbox02 from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { Backup } from '@/api/backup';
import { BackButton } from '@/components/backbutton/backbutton';
import { Button } from '@/components/forms';
import { Message } from '@/components/message/message';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { SetPasswordWithBackup } from './password';
import { RestoreFromSDCardBackup } from './restore';
import { WithSDCard } from './sdcard';
import { SetDeviceName } from './name';
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
      <WithSDCard onAbort={onAbort} deviceID={deviceID}>
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
  const [status, setStatus] = useState<
    'securityNotice' | 'intro' | 'setName' | 'restoreMnemonic'
  >('securityNotice');

  const restoreMnemonic = () => {
    bitbox02.restoreFromMnemonic(deviceID)
      .then(result => {
        if (!result.success) {
          const errorText = (
            result.code === bitbox02.errUserAbort
              ? t('bitbox02Wizard.restoreFromMnemonic.e104')
              : t('bitbox02Wizard.restoreFromMnemonic.failed')
          );
          alertUser(errorText, {
            asDialog: false,
            callback: () => onAbort(),
          });
        }
      })
      .catch(console.error);
  };

  const setDeviceName = async (deviceName: string) => {
    try {
      setStatus('setName');
      const result = await bitbox02.setDeviceName(deviceID, deviceName);
      if (!result.success) {
        const errorText = (
          result.code === bitbox02.errUserAbort
            ? t('bitbox02Settings.deviceName.error_104')
            : result.message
        );
        alertUser(errorText || t('genericError'), {
          asDialog: false,
          callback: () => onAbort(),
        });
        return;
      }
      setStatus('restoreMnemonic');
      restoreMnemonic();
    } catch (error) {
      console.error(error);
    }
  };

  switch (status) {
  case 'securityNotice':
    return (
      <View
        fullscreen
        textCenter
        verticallyCentered
        withBottomBar
        width="700px">
        <ViewHeader
          small
          title={t('bitbox02Wizard.stepUninitialized.restoreMnemonic')} />
        <ViewContent textAlign="left">
          <Message type="info">
            {t('bitbox02Wizard.restoreFromMnemonic.securityNotice')}
          </Message>
        </ViewContent>
        <ViewButtons>
          <Button primary onClick={() => setStatus('intro')}>
            {t('button.continue')}
          </Button>
          <BackButton onClick={onAbort}>
            {t('button.back')}
          </BackButton>
        </ViewButtons>
      </View>
    );
  case 'intro':
    return (
      <SetDeviceName
        missingSDCardWarning={false}
        onDeviceName={setDeviceName}
        onBack={onAbort} />
    );
  case 'setName':
    return (
      <Wait title={t('bitbox02Interact.confirmName')} />
    );
  case 'restoreMnemonic':
    return (
      <Wait
        title={t('bitbox02Interact.followInstructionsMnemonicTitle')}
        text={t('bitbox02Interact.followInstructionsMnemonic')} />
    );
  }
};