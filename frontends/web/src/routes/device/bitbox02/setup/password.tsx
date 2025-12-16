// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Backup } from '@/api/backup';
import { PasswordEntry } from '@/routes/device/bitbox02/components/password-entry/password-entry';
import { Message } from '@/components/message/message';
import { MultilineMarkup } from '@/utils/markup';
import { convertDateToLocaleString } from '@/utils/date';

type Props = {
  errorText: string | undefined;
};

export const SetPassword = ({ errorText }: Props) => {
  const { t } = useTranslation();
  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="600px">
      <ViewHeader title={t('bitbox02Wizard.stepPassword.title')}>
        {errorText && (
          <Message className="margin-bottom-default" type="warning">
            <span>{errorText}</span>
          </Message>
        )}
        <p>{t('bitbox02Wizard.stepPassword.useControls')}</p>
      </ViewHeader>
      <ViewContent>
        <PasswordEntry />
      </ViewContent>
    </View>
  );
};

type PropsWithBackup = {
  forBackup?: Backup;
};

export const SetPasswordWithBackup = ({
  forBackup,
}: PropsWithBackup) => {
  const { i18n, t } = useTranslation();
  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="700px">
      <ViewHeader
        small
        title={t('backup.restore.confirmTitle')}
      >
        { forBackup ? (
          <div>
            <MultilineMarkup tagName="div" markup={t('backup.restore.selectedBackup', {
              backupName: forBackup.name,
              createdDateTime: convertDateToLocaleString(forBackup.date, i18n.language),
            })}/>
            <p className="text-small text-ellipsis">
              ID:
              {' '}
              {forBackup.id}
            </p>
          </div>
        ) : null }
      </ViewHeader>
      <ViewContent>
        <p>{t('bitbox02Wizard.stepPassword.useControls')}</p>
        <PasswordEntry />
      </ViewContent>
    </View>
  );
};
