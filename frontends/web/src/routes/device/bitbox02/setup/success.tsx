// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms';

type TProps = {
  onContinue: () => void;
};

type TCreateProps = TProps & {
  backupType: 'sdcard' | 'mnemonic';
};

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
      <ViewHeader
        small
        title={t('bitbox02Wizard.stepBackupSuccess.title')}
      />
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
      <ViewHeader
        small
        title={t('bitbox02Wizard.stepBackupSuccess.title')}
      />
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
