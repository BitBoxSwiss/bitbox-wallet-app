// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { getPassphraseState, passphraseChanged, requestHostPassphrase } from '@/api/bitbox02';
import { Button } from '@/components/forms';
import { PointToBitBox02 } from '@/components/icon/combined';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { useSync } from '@/hooks/api';
import { PasswordEntry } from './components/password-entry/password-entry';
import { ForgotPasswordInfo } from './components/forgot-password-info/forgot-password-info';
import { PassphraseDialog } from './components/passphrase-dialog';

type TProps = {
  deviceID: string;
  attestation: boolean | null | undefined;
};

export const Unlock = ({ deviceID, attestation }: TProps) => {
  const { t } = useTranslation();
  const passphrase = useSync(
    () => getPassphraseState(deviceID),
    cb => passphraseChanged(deviceID, cb),
    state => state.revision,
  );
  const enteringPassphrase = !!passphrase?.phase;
  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="690px">
      <ViewHeader title={t('button.unlock')}>
        <p>
          {enteringPassphrase
            ? t('bitbox02Wizard.passphrase.enter')
            : t('bitbox02Wizard.stepConnected.unlock')}
        </p>
        {passphrase?.phase === 'device' && (
          <Button transparent inline onClick={() => requestHostPassphrase(deviceID, passphrase.id)}>
            {t('bitbox02Wizard.passphrase.enterInApp')}
          </Button>
        )}
      </ViewHeader>
      <ViewContent fullWidth>
        {attestation === false ? (
          <Message type="warning">
            {t('bitbox02Wizard.attestationFailed')}
          </Message>
        ) : (
          <>
            <PasswordEntry />
            {!enteringPassphrase && <ForgotPasswordInfo />}
          </>
        )}
      </ViewContent>
      {passphrase?.phase === 'host-consent' && (
        <WaitDialog noSidebarOffset title={t('bitbox02Wizard.passphrase.dialogTitle')}>
          <p>{t('bitbox02Wizard.passphrase.confirmHostEntry')}</p>
          <PointToBitBox02 />
        </WaitDialog>
      )}
      {passphrase?.phase === 'host' && (
        <PassphraseDialog key={passphrase.id} deviceID={deviceID} id={passphrase.id} />
      )}
      {passphrase?.phase === 'confirm' && (
        <WaitDialog noSidebarOffset title={t('bitbox02Wizard.passphrase.confirmTitle')}>
          <PointToBitBox02 />
        </WaitDialog>
      )}
    </View>
  );
};
