// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { BackButton } from '@/components/backbutton/backbutton';
import { Button } from '@/components/forms';
import { NumberInput } from '@/components/forms/input-number';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { Logo } from '@/components/icon/logo';
import { Column, ColumnButtons, GuideWrapper, GuidedContent, Header, Main, ResponsiveGrid } from '@/components/layout';
import { Message } from '@/components/message/message';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { ConfirmSend } from '@/routes/account/send/components/confirm/confirm';
import { FiatInput } from '@/routes/account/send/components/inputs/fiat-input';
import { NoteInput } from '@/routes/account/send/components/inputs/note-input';
import { SendResult } from '@/routes/account/send/components/result';
import { FeeTargets } from '@/routes/account/send/feetargets';
import { TProposalError } from '@/routes/account/send/services';
import styles from './top-up.module.css';

type TProps = {
  amount: string;
  customFee: string;
  defaultCurrency: accountApi.Fiat;
  displayedCoinUnit?: string;
  errorHandling: TProposalError;
  feeTarget?: accountApi.FeeTargetCode;
  fiatAmount: string;
  isConfirming: boolean;
  isUpdatingProposal: boolean;
  lightningBalance?: accountApi.TBalance;
  note: string;
  onBack: () => void;
  onCoinAmountChange: (amount: string) => void;
  onCustomFee: (customFee: string) => void;
  onFeeTargetChange: (feeTarget: accountApi.FeeTargetCode) => void;
  onFiatChange: (fiatAmount: string) => void;
  onRetry: () => void;
  onSend: () => void;
  onSourceAccountChange: (code: string) => void;
  onNoteChange: (note: string) => void;
  proposedAmount?: accountApi.TAmountWithConversions;
  proposedFee?: accountApi.TAmountWithConversions;
  proposedTotal?: accountApi.TAmountWithConversions;
  recipientDisplayAddress: string;
  sendDisabled: boolean;
  sendResult?: accountApi.TSendTx;
  sourceAccount?: accountApi.TAccount;
  sourceAccountCode?: accountApi.AccountCode;
  sourceAccounts: accountApi.TAccount[];
};

type TEmptyStateProps = {
  onBack: () => void;
  onManageAccounts: () => void;
};

export const TopUpEmptyState = ({ onBack, onManageAccounts }: TEmptyStateProps) => {
  const { t } = useTranslation();
  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('lightning.topUp.title')}</h2>} />
          <View>
            <ViewContent>
              <Message type="info">
                {t('lightning.topUp.noActiveSourceAccount')}
              </Message>
              <ViewButtons>
                <Button primary onClick={onManageAccounts}>
                  {t('manageAccounts.title')}
                </Button>
                <BackButton onClick={onBack}>
                  {t('button.back')}
                </BackButton>
              </ViewButtons>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};

export const TopUpForm = ({
  amount,
  customFee,
  defaultCurrency,
  displayedCoinUnit,
  errorHandling,
  feeTarget,
  fiatAmount,
  isConfirming,
  isUpdatingProposal,
  lightningBalance,
  note,
  onBack,
  onCoinAmountChange,
  onCustomFee,
  onFeeTargetChange,
  onFiatChange,
  onRetry,
  onSend,
  onSourceAccountChange,
  onNoteChange,
  proposedAmount,
  proposedFee,
  proposedTotal,
  recipientDisplayAddress,
  sendDisabled,
  sendResult,
  sourceAccount,
  sourceAccountCode,
  sourceAccounts,
}: TProps) => {
  const { t } = useTranslation();

  return (
    <View>
      <ViewContent>
        <ResponsiveGrid className={styles.form} col="1">
          <Column>
            <div className={styles.field}>
              <label>{t('lightning.topUp.from')}</label>
              <GroupedAccountSelector
                accounts={sourceAccounts}
                selected={sourceAccountCode}
                onChange={onSourceAccountChange}
              />
            </div>
          </Column>
          <Column>
            <div className={styles.field}>
              <label>{t('send.confirm.to')}</label>
              <div className={styles.assetField}>
                <Logo coinCode="lightning" alt={t('lightning.accountLabel')} />
                <span className={styles.assetLabel}>{t('lightning.accountLabel')}</span>
                <span className={styles.assetBalance}>
                  {lightningBalance !== undefined ? (
                    <AmountWithUnit maxDecimals={9} amount={lightningBalance.available} />
                  ) : null}
                </span>
              </div>
            </div>
          </Column>
          <Column>
            <NumberInput
              step="any"
              min="0"
              label={displayedCoinUnit || t('send.amount.label')}
              id="amount"
              onChange={onCoinAmountChange}
              error={errorHandling.amountError}
              value={amount}
              placeholder={t('send.amount.placeholder')}
            />
          </Column>
          <Column>
            <FiatInput
              onFiatChange={onFiatChange}
              disabled={false}
              error={errorHandling.amountError}
              fiatAmount={fiatAmount}
              label={defaultCurrency}
            />
          </Column>
          <Column>
            {sourceAccount && (
              <FeeTargets
                key={sourceAccount.code}
                accountCode={sourceAccount.code}
                coinCode={sourceAccount.coinCode}
                disabled={!amount}
                proposedFee={proposedFee}
                customFee={customFee}
                showCalculatingFeeLabel={isUpdatingProposal}
                onFeeTargetChange={onFeeTargetChange}
                onCustomFee={onCustomFee}
                error={errorHandling.feeError}
              />
            )}
          </Column>
          <Column>
            <NoteInput
              note={note}
              onNoteChange={onNoteChange}
            />
            <ColumnButtons
              className={styles.buttons}
              inline>
              <Button
                primary
                onClick={onSend}
                disabled={sendDisabled}>
                {t('send.button')}
              </Button>
              <BackButton
                enableEsc={!isConfirming}
                onClick={onBack}
              >
                {t('button.back')}
              </BackButton>
            </ColumnButtons>
          </Column>
        </ResponsiveGrid>
      </ViewContent>
      <ConfirmSend
        note={note}
        hasSelectedUTXOs={false}
        isConfirming={isConfirming}
        selectedUTXOs={{}}
        coinCode={sourceAccount?.coinCode || 'btc'}
        transactionDetails={{
          selectedReceiverAccountName: t('lightning.accountLabel'),
          proposedFee,
          proposedAmount,
          proposedTotal,
          customFee,
          feeTarget,
          recipientDisplayAddress,
        }}
      />
      {sourceAccount && (
        <SendResult
          code={sourceAccount.code}
          doneRoute="/lightning"
          result={sendResult}
          onRetry={onRetry}
          showSuccessActions={false}
          successMessage={t('lightning.topUp.success.message')}
        />
      )}
    </View>
  );
};
