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
import { View, ViewContent, ViewHeader } from '../../../../components/view/view';
import { Backup } from '../../components/backup';
import { PasswordEntry } from '../components/password-entry/password-entry';
import { Status } from '../../../../components/status/status';
import { MultilineMarkup } from '../../../../utils/markup';
import { convertDateToLocaleString } from '../../../../utils/date';

type Props = {
  errorText: string | undefined;
}

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
          <Status type="warning">
            <span>{errorText}</span>
          </Status>
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
}

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
      <ViewHeader title={t('backup.restore.confirmTitle')}>
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
