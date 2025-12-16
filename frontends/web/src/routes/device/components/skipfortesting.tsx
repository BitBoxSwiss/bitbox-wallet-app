// SPDX-License-Identifier: Apache-2.0

import React, { ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '@/contexts/AppContext';
import { registerTest } from '@/api/keystores';
import { Button } from '@/components/forms';
import { PasswordSingleInput } from '@/components/password';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';

type TProps = {
  children?: ReactNode;
  className?: string;
};

export const SkipForTesting = ({
  children,
  className,
}: TProps) => {
  const { t } = useTranslation();
  const { isTesting } = useContext(AppContext);
  const [dialog, setDialog] = useState(false);
  const [testPIN, setTestPIN] = useState('');
  const registerTestingDevice = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    await registerTest(testPIN);
    setDialog(false);
  };

  if (!isTesting) {
    return null;
  }
  return (
    <>
      <Button
        className={className}
        onClick={() => setDialog(true)}
        primary
      >
        {children ? children : t('testWallet.prompt.title')}
      </Button>
      <Dialog
        open={dialog}
        title={t('testWallet.prompt.title')}
        onClose={() => setDialog(false)}>
        <form onSubmit={registerTestingDevice}>
          <PasswordSingleInput
            autoFocus
            label={t('testWallet.prompt.passwordLabel')}
            onValidPassword={(pw) => setTestPIN(pw ? pw : '')}/>
          <DialogButtons>
            <Button primary type="submit">
              {t('testWallet.prompt.button')}
            </Button>
          </DialogButtons>
        </form>
      </Dialog>
    </>
  );
};
