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

import { useTranslation } from 'react-i18next';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms';

type TProps = {
  onContinue: () => void;
};

type TCreateProps = TProps & {
  backupType: 'sdcard' | 'mnemonic';
}

export const CreateWalletSuccess = ({
  backupType,
  onContinue,
}: TCreateProps) => {
  const { t } = useTranslation();
  return (
    <View
      fitContent
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar>
      <ViewHeader title={t('bitbox02Wizard.success.title')}>
        <p>{t('bitbox02Wizard.stepCreateSuccess.success')}</p>
      </ViewHeader>
      <ViewContent withIcon="success">
        <p>
          { backupType === 'sdcard'
            ? t('bitbox02Wizard.stepCreateSuccess.removeMicroSD')
            : t('bitbox02Wizard.stepCreateSuccess.storeMnemonic') }
        </p>
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={onContinue}>
          {t('success.getstarted')}
        </Button>
      </ViewButtons>
    </View>
  );
};

export const RestoreFromSDCardSuccess = ({ onContinue }: TProps) => {
  const { t } = useTranslation();
  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="700px">
      <ViewHeader title={t('bitbox02Wizard.stepBackupSuccess.title')} />
      <ViewContent textAlign="left">
        <p>
          {t('bitbox02Wizard.stepCreateSuccess.removeMicroSD')}
        </p>
        <p className="m-bottom-default">
          {t('bitbox02Wizard.stepBackupSuccess.fundsSafe')}
        </p>
        <ul>
          <li>{t('bitbox02Wizard.backup.userConfirmation1')}</li>
          <li>{t('bitbox02Wizard.backup.userConfirmation2')}</li>
          <li>{t('bitbox02Wizard.backup.userConfirmation3')}</li>
          <li>{t('bitbox02Wizard.backup.userConfirmation4')}</li>
          <li>{t('bitbox02Wizard.backup.userConfirmation5')}</li>
        </ul>
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={onContinue}>
          {t('success.getstarted')}
        </Button>
      </ViewButtons>
    </View>
  );
};

export const RestoreFromMnemonicSuccess = ({ onContinue }: TProps) => {
  const { t } = useTranslation();
  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="700px">
      <ViewHeader title={t('bitbox02Wizard.stepBackupSuccess.title')} />
      <ViewContent textAlign="left">
        <p className="m-bottom-default">
          {t('bitbox02Wizard.stepBackupSuccess.fundsSafe')}
        </p>
        <ul>
          <li>{t('bitbox02Wizard.backup.userConfirmation1')}</li>
          <li>{t('bitbox02Wizard.backup.userConfirmation2')}</li>
          <li>{t('bitbox02Wizard.backup.userConfirmation3')}</li>
          <li>{t('bitbox02Wizard.backup.userConfirmation4')}</li>
          <li>{t('bitbox02Wizard.backup.userConfirmation5mnemonic')}</li>
        </ul>
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={onContinue}>
          {t('success.getstarted')}
        </Button>
      </ViewButtons>
    </View>
  );
};
