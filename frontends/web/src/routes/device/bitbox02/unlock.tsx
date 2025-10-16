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
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { PasswordEntry } from './components/password-entry/password-entry';

type Props = {
  attestation: boolean | null | undefined;
};

export const Unlock = ({ attestation }: Props) => {
  const { t } = useTranslation();
  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="690px">
      <ViewHeader title={t('button.unlock')}>
        <p>
          {t('bitbox02Wizard.stepConnected.unlock')}
        </p>
      </ViewHeader>
      <ViewContent fullWidth>
        {attestation === false ? (
          <Message>
            {t('bitbox02Wizard.attestationFailed')}
          </Message>
        ) : (
          <PasswordEntry />
        )}
      </ViewContent>
    </View>
  );
};
