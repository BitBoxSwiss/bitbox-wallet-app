// SPDX-License-Identifier: Apache-2.0

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
          <Message type="warning">
            {t('bitbox02Wizard.attestationFailed')}
          </Message>
        ) : (
          <PasswordEntry />
        )}
      </ViewContent>
    </View>
  );
};
