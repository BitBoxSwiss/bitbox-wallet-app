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

import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../../../components/view/view';
import { Status } from '../../../../components/status/status';
import { Button, Input } from '../../../../components/forms';
import { checkSDCard } from '../../../../api/bitbox02';
import style from './name.module.css';

// matches any character that is not a printable ASCII character or space
const regexInvalid = /[^ -~]/g;

const filterUnique = (value: string, index: number, array: string[]) => {
  return array.indexOf(value) === index;
};

type TProps = {
  onDeviceName: (name: string) => void;
  onBack: () => void;
}

type TSetDeviceNameProps = TProps & {
  missingSDCardWarning?: boolean;
}

export const SetDeviceName = ({
  onDeviceName,
  onBack,
  missingSDCardWarning,
}: TSetDeviceNameProps) => {
  const { t } = useTranslation();
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState<'tooLong' | 'invalidChars' | false>();

  const handleDeviceNameInput = (event: Event) => {
    const target = (event.target as HTMLInputElement);
    const value: string = target.value;
    const valueTrimmed: string = value.trim();

    if (valueTrimmed.length < 1) {
      setError(undefined);
    } else if (valueTrimmed.length > 30) {
      setError('tooLong');
    } else if (regexInvalid.test(valueTrimmed)) {
      setError('invalidChars');
    } else {
      setError(false);
    }
    setDeviceName(value);
  };

  const invalidChars = deviceName.match(regexInvalid)?.filter(filterUnique).join(', ');

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
        <ViewHeader title={t('bitbox02Wizard.stepCreate.title')}>
          <p>{t('bitbox02Wizard.stepCreate.description')}</p>
          {missingSDCardWarning && (
            <Status className="m-bottom-half" type="warning">
              <span>{t('bitbox02Wizard.stepCreate.toastMicroSD')}</span>
            </Status>
          )}
        </ViewHeader>
        <ViewContent textAlign="left" minHeight="140px">
          <Input
            autoFocus
            className={`${style.wizardLabel} ${error ? style.inputError : ''}`}
            label={t('bitbox02Wizard.stepCreate.nameLabel')}
            onInput={handleDeviceNameInput}
            placeholder={t('bitbox02Wizard.stepCreate.namePlaceholder')}
            value={deviceName}
            id="deviceName">
            <span hidden={!error} className={style.errorMessage}>
              {t(`bitbox02Wizard.stepCreate.error.${error}`, {
                invalidChars
              })}
              {' '}
              {t('bitbox02Wizard.stepCreate.error.genericMessage')}
            </span>
          </Input>
        </ViewContent>
        <ViewButtons>
          <Button
            disabled={!!error || error !== false}
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

type TPropsWithSDCard = TProps & {
  deviceID: string;
}

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
