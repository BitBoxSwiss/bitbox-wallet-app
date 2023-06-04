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
import style from './name.module.css';
import { checkSDCard } from '../../../../api/bitbox02';

type Props = {
  deviceID: string;
  onDeviceName: (name: string) => void;
  onBack: () => void;
}

export const SetDeviceName = ({
  deviceID,
  onDeviceName,
  onBack,
}: Props) => {
  const { t } = useTranslation();
  const [deviceName, setDeviceName] = useState('');
  const [hasSDCard, setSDCard] = useState<boolean>();

  useEffect(() => {
    checkSDCard(deviceID).then(setSDCard);
  }, [deviceID]);

  const handleDeviceNameInput = (event: Event) => {
    const target = (event.target as HTMLInputElement);
    const value: string = target.value;
    setDeviceName(value);
  };

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
          {hasSDCard === false && (
            <Status className="m-bottom-half" type="warning">
              <span>{t('bitbox02Wizard.stepCreate.toastMicroSD')}</span>
            </Status>
          )}
        </ViewHeader>
        <ViewContent minHeight="90px">
          <Input
            autoFocus
            className={style.wizardLabel}
            label={t('bitbox02Wizard.stepCreate.nameLabel')}
            pattern="^.{0,63}$"
            onInput={handleDeviceNameInput}
            placeholder={t('bitbox02Wizard.stepCreate.namePlaceholder')}
            value={deviceName}
            id="deviceName" />
        </ViewContent>
        <ViewButtons>
          <Button
            disabled={!deviceName}
            primary
            type="submit">
            {t('button.continue')}
          </Button>
          <Button
            onClick={onBack}
            transparent
            type="button">
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    </form>
  );
};
