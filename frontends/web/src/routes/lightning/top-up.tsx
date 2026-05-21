// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as accountApi from '@/api/account';
import { connectKeystore } from '@/api/keystores';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { View, ViewHeader } from '@/components/view/view';
import { RatesContext } from '@/contexts/RatesContext';
import { getDisplayedCoinUnit } from '@/routes/account/utils';
import { useTopUpDraft } from './top-up-draft';
import { TopUpEmptyState, TopUpForm } from './top-up-form';
import { useBoardingAddress, useLightningBalance, useTopUpSourceAccount } from './top-up-hooks';

export const TopUp = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { btcUnit, defaultCurrency } = useContext(RatesContext);
  const { boardingAddress, boardingAddressError } = useBoardingAddress();
  const lightningBalance = useLightningBalance();
  const {
    setSourceAccountCode,
    sourceAccount,
    sourceAccountCode,
    sourceAccounts,
    topUpInfoError,
  } = useTopUpSourceAccount();

  const [isConfirming, setIsConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [sendResult, setSendResult] = useState<accountApi.TSendTx>();
  const draft = useTopUpDraft({
    boardingAddress,
    btcUnit,
    defaultCurrency,
    sourceAccount,
  });

  useEffect(() => {
    if (!sendResult?.success) {
      return undefined;
    }
    const timeout = window.setTimeout(() => navigate('/lightning'), 1000);
    return () => window.clearTimeout(timeout);
  }, [navigate, sendResult]);

  const handleRetry = () => {
    setSendResult(undefined);
  };

  const handleSourceAccountChange = (code: string) => {
    setSourceAccountCode(code);
    draft.resetProposal();
  };

  const handleSend = useCallback(async () => {
    if (!sourceAccount) {
      return;
    }
    const connectResult = await connectKeystore(sourceAccount.keystore.rootFingerprint);
    if (!connectResult.success) {
      return;
    }
    setIsConfirming(true);
    try {
      setSendResult(await accountApi.sendTx(sourceAccount.code, note));
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirming(false);
    }
  }, [note, sourceAccount]);

  if (topUpInfoError) {
    return (
      <View textCenter verticallyCentered>
        <ViewHeader title={t('unknownError', { errorMessage: topUpInfoError })} />
      </View>
    );
  }

  if (sourceAccounts === undefined) {
    return <Spinner />;
  }

  if (sourceAccounts.length === 0) {
    return (
      <TopUpEmptyState
        onBack={() => navigate('/lightning')}
        onManageAccounts={() => navigate('/settings/manage-accounts')}
      />
    );
  }

  if (boardingAddressError) {
    return (
      <View textCenter verticallyCentered>
        <ViewHeader title={t('unknownError', { errorMessage: boardingAddressError })} />
      </View>
    );
  }

  if (!boardingAddress) {
    return <Spinner />;
  }

  const displayedCoinUnit = sourceAccount
    ? getDisplayedCoinUnit(sourceAccount.coinCode, sourceAccount.coinUnit, btcUnit)
    : undefined;

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('lightning.topUp.title')}</h2>} />
          <TopUpForm
            amount={draft.amount}
            customFee={draft.customFee}
            defaultCurrency={defaultCurrency}
            displayedCoinUnit={displayedCoinUnit}
            errorHandling={draft.errorHandling}
            feeTarget={draft.feeTarget}
            fiatAmount={draft.fiatAmount}
            isConfirming={isConfirming}
            isUpdatingProposal={draft.isUpdatingProposal}
            lightningBalance={lightningBalance}
            note={note}
            onBack={() => navigate('/lightning')}
            onCoinAmountChange={draft.handleCoinAmountChange}
            onCustomFee={draft.handleCustomFee}
            onFeeTargetChange={draft.handleFeeTargetChange}
            onFiatChange={draft.handleFiatInput}
            onNoteChange={setNote}
            onRetry={handleRetry}
            onSend={handleSend}
            onSourceAccountChange={handleSourceAccountChange}
            proposedAmount={draft.proposedAmount}
            proposedFee={draft.proposedFee}
            proposedTotal={draft.proposedTotal}
            recipientDisplayAddress={draft.recipientDisplayAddress}
            sendDisabled={draft.sendDisabled}
            sendResult={sendResult}
            sourceAccount={sourceAccount}
            sourceAccountCode={sourceAccountCode}
            sourceAccounts={sourceAccounts}
          />
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};
