// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AccountCode, TAccount } from '@/api/account';
import { Header, Main } from '@/components/layout';
import { CloseWithdrawConfirm } from './confirm-step';
import { CloseWithdrawFailure } from './failure-step';
import { CloseWithdrawSuccess } from './success-step';

type TStep = 'confirm' | 'failure' | 'success';

type TProps = {
  activeAccounts: TAccount[];
};

export const LightningCloseWithdrawFunds = ({
  activeAccounts,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const btcAccounts = useMemo(
    () => activeAccounts.filter(account => account.active && account.coinCode === 'btc'),
    [activeAccounts]
  );
  const [destinationAccountCode, setDestinationAccountCode] = useState<AccountCode>(btcAccounts[0]?.code || '');
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState<TStep>('confirm');
  const canClose = confirmed && !!destinationAccountCode;

  useEffect(() => {
    if (!btcAccounts.length) {
      setDestinationAccountCode('');
      return;
    }
    if (!destinationAccountCode || !btcAccounts.some(account => account.code === destinationAccountCode)) {
      setDestinationAccountCode(btcAccounts[0]?.code || '');
    }
  }, [btcAccounts, destinationAccountCode]);

  const renderStep = () => {
    switch (step) {
    case 'confirm':
      return (
        <CloseWithdrawConfirm
          btcAccounts={btcAccounts}
          canClose={canClose}
          confirmed={confirmed}
          destinationAccountCode={destinationAccountCode}
          onCancel={() => navigate(-1)}
          onClose={() => setStep('success')}
          onConfirmChange={() => setConfirmed(current => !current)}
          onDestinationAccountChange={setDestinationAccountCode}
        />
      );
    case 'failure':
      return (
        <CloseWithdrawFailure
          onCancel={() => navigate('/settings/lightning-settings')}
          onTryAgain={() => {
            setConfirmed(false);
            setStep('confirm');
          }}
        />
      );
    case 'success':
      return (
        <CloseWithdrawSuccess onDone={() => navigate('/settings/lightning-settings')} />
      );
    }
  };

  return (
    <Main>
      <Header title={t('lightning.settings.closeAndWithdrawFunds')} />
      {renderStep()}
    </Main>
  );
};
