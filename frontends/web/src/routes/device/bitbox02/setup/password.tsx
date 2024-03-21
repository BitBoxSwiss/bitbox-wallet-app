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
import { i18n } from '../../../../i18n/i18n';
import { View, ViewContent, ViewHeader } from '../../../../components/view/view';
import { Backup } from '../../../../api/backup';
import { PasswordEntry } from '../components/password-entry/password-entry';
import { Status } from '../../../../components/status/status';
import { MultilineMarkup } from '../../../../utils/markup';
import { convertDateToLocaleString } from '../../../../utils/date';
import { A } from '../../../../components/anchor/anchor';
import { Info } from '../../../../components/icon';
import style from './password.module.css';

type Props = {
  errorText: string | undefined;
}

const getSupportLink = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://bitbox.swiss/redirects/device-password-recommendation-de/';
  default:
    return 'https://bitbox.swiss/redirects/device-password-recommendation-en/';
  }
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
          <Status type="warning">
            <span>{errorText}</span>
          </Status>
        )}
        <p>{t('bitbox02Wizard.stepPassword.useControls')}</p>
      </ViewHeader>
      <ViewContent>
        <PasswordEntry />
        <br />
        <p className="text-small text-gray">
          <Info className={style.textIcon} />
          <A href={getSupportLink()}>{t('bitbox02Wizard.stepPassword.recommendLength.link')}</A>&nbsp;
          {t('bitbox02Wizard.stepPassword.recommendLength.text')}
        </p>
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
        <br />
        <p className="text-small text-gray">
          <Info className={style.textIcon} />
          <A href={getSupportLink()}>{t('bitbox02Wizard.stepPassword.recommendLength.link')}</A>&nbsp;
          {t('bitbox02Wizard.stepPassword.recommendLength.text')}
        </p>
      </ViewContent>
    </View>
  );
};
