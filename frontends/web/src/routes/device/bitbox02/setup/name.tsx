// SPDX-License-Identifier: Apache-2.0

import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { Button, Input } from '@/components/forms';
import { checkSDCard } from '@/api/bitbox02';
import { useValidateDeviceName } from '@/hooks/devicename';
import { TDeviceNameError } from '@/utils/types';
import style from './name.module.css';

type TProps = {
  onDeviceName: (name: string) => void;
  onBack: () => void;
};

type TSetDeviceNameProps = TProps & {
  missingSDCardWarning?: boolean;
};

export const SetDeviceName = ({
  onDeviceName,
  onBack,
  missingSDCardWarning,
}: TSetDeviceNameProps) => {
  const { t } = useTranslation();
  const [deviceName, setDeviceName] = useState('');
  const { error, invalidChars, nameIsTooShort } = useValidateDeviceName(deviceName);

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onDeviceName(deviceName);
      }}>
      <View
        fullscreen
        textCenter
        withBottomBar
        verticallyCentered
        width="600px">
        <ViewHeader
          small
          title={t('bitbox02Wizard.stepCreate.title')}
        >
          <p>{t('bitbox02Wizard.stepCreate.description')}</p>
          {missingSDCardWarning && (
            <Message className="m-bottom-half" type="warning">
              <span>{t('bitbox02Wizard.stepCreate.toastMicroSD')}</span>
            </Message>
          )}
        </ViewHeader>
        <ViewContent textAlign="left" minHeight="140px">
          <Input
            autoFocus
            className={style.input}
            classNameInputField={error && !nameIsTooShort && style.inputFieldError || ''}
            label={t('bitbox02Wizard.stepCreate.nameLabel')}
            onInput={(e) => setDeviceName(e.target.value)}
            placeholder={t('bitbox02Wizard.stepCreate.namePlaceholder')}
            value={deviceName}
            id="deviceName"
          />
          <DeviceNameErrorMessage error={error} invalidChars={invalidChars} />
        </ViewContent>
        <ViewButtons>
          <Button
            disabled={!!error}
            primary
            type="submit">
            {t('button.continue')}
          </Button>
          <Button
            onClick={onBack}
            secondary
            type="button">
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    </form>
  );
};

type TDeviceNameErrorMessageProps = {
  error: TDeviceNameError;
  invalidChars?: string;
};

export const DeviceNameErrorMessage = ({ error, invalidChars }: TDeviceNameErrorMessageProps) => {
  const { t } = useTranslation();
  if (error === 'tooShort') {
    return null;
  }
  return (
    <span hidden={!error} className={style.errorMessage}>
      {error && t(`bitbox02Wizard.stepCreate.error.${error}`, {
        invalidChars
      })}
      {' '}
      {t('bitbox02Wizard.stepCreate.error.genericMessage')}
    </span>
  );
};

type TPropsWithSDCard = TProps & {
  deviceID: string;
};

export const SetDeviceNameWithSDCard = ({
  deviceID,
  onDeviceName,
  onBack,
}: TPropsWithSDCard) => {
  const [hasSDCard, setSDCard] = useState<boolean>();

  useEffect(() => {
    checkSDCard(deviceID).then(setSDCard);
  }, [deviceID]);

  return (
    <SetDeviceName
      onDeviceName={onDeviceName}
      onBack={onBack}
      missingSDCardWarning={hasSDCard === false} />
  );
};
