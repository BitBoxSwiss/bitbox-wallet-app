// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, CoinCode, ConversionUnit, FeeTargetCode, TAccount, TAmountWithConversions, TBalance, TTxProposalResult } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Button, NumberInput } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { Logo } from '@/components/icon/logo';
import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { Status } from '@/components/status/status';
import { View, ViewContent } from '@/components/view/view';
import { FeeTargets } from '@/routes/account/send/feetargets';
import { FiatInput } from '@/routes/account/send/components/inputs/fiat-input';
import { NoteInput } from '@/routes/account/send/components/inputs/note-input';
import type { TProposalError } from '@/routes/account/send/services';
import styles from './topup.module.css';

type TReadonlyAccountRowProps = {
  balance?: TAmountWithConversions;
  coinCode: CoinCode;
  name: string;
};

const ReadonlyAccountRow = ({
  balance,
  coinCode,
  name,
}: TReadonlyAccountRowProps) => (
  <div className={styles.accountRow}>
    <Logo coinCode={coinCode} alt={name} className={styles.accountLogo} />
    <span className={styles.accountName}>{name}</span>
    <span className={styles.accountBalance}>
      {balance ? (
        <AmountWithUnit maxDecimals={9} amount={balance} />
      ) : (
        '-'
      )}
    </span>
  </div>
);

type TProps = {
  amount: string;
  balanceLimitError?: string;
  btcAccounts: TAccount[];
  canReview: boolean;
  customFee: string;
  defaultCurrency: ConversionUnit;
  errorHandling: TProposalError;
  fiatAmount: string;
  isSubmitting: boolean;
  isUpdatingProposal: boolean;
  lightningBalance?: TBalance;
  note: string;
  onAmountChange: (value: string) => void;
  onBack: () => void;
  onCustomFeeChange: (customFee: string) => void;
  onFeeTargetChange: (feeTarget: FeeTargetCode) => void;
  onFiatChange: (value: string) => void;
  onNoteChange: (note: string) => void;
  onReview: () => void;
  onSourceChange: (code: AccountCode) => void;
  proposal?: TTxProposalResult;
  sendError?: string;
  sourceAccount?: TAccount;
  sourceAccountCode: AccountCode;
  sourceAmountUnit: string;
};

export const TopUpForm = ({
  amount,
  balanceLimitError,
  btcAccounts,
  canReview,
  customFee,
  defaultCurrency,
  errorHandling,
  fiatAmount,
  isSubmitting,
  isUpdatingProposal,
  lightningBalance,
  note,
  onAmountChange,
  onBack,
  onCustomFeeChange,
  onFeeTargetChange,
  onFiatChange,
  onNoteChange,
  onReview,
  onSourceChange,
  proposal,
  sendError,
  sourceAccount,
  sourceAccountCode,
  sourceAmountUnit,
}: TProps) => {
  const { t } = useTranslation();

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('lightning.topUp.title')}</h2>}>
            <HideAmountsButton />
          </Header>
          <Status dismissibleKey="" type="error" hidden={!balanceLimitError}>
            {balanceLimitError}
          </Status>
          <Status dismissibleKey="" type="warning" hidden={!sendError}>
            {sendError}
          </Status>
          <View fitContent minHeight="100%" verticallyCentered>
            <ViewContent>
              <Grid col="1" className={styles.form}>
                <Column>
                  <label className={styles.fieldLabel}>{t('lightning.topUp.from')}</label>
                  <GroupedAccountSelector
                    accounts={btcAccounts}
                    className={styles.accountSelector}
                    onChange={onSourceChange}
                    selected={sourceAccountCode}
                  />
                </Column>
                <Column>
                  <label className={styles.fieldLabel}>{t('lightning.topUp.to')}</label>
                  <ReadonlyAccountRow
                    balance={lightningBalance?.available}
                    coinCode="lightning"
                    name={t('lightning.accountLabel')}
                  />
                </Column>
                <Column>
                  <NumberInput
                    step="any"
                    min="0"
                    label={sourceAmountUnit}
                    id="topUpAmount"
                    onChange={onAmountChange}
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
                {sourceAccount && (
                  <Column>
                    <FeeTargets
                      accountCode={sourceAccount.code}
                      coinCode={sourceAccount.coinCode}
                      disabled={!amount}
                      proposedFee={proposal?.success ? proposal.fee : undefined}
                      customFee={customFee}
                      showCalculatingFeeLabel={isUpdatingProposal}
                      onFeeTargetChange={onFeeTargetChange}
                      onCustomFee={onCustomFeeChange}
                      error={errorHandling.feeError}
                    />
                  </Column>
                )}
                <Column>
                  <NoteInput
                    note={note}
                    onNoteChange={onNoteChange}
                  />
                  <ColumnButtons className="m-top-default m-bottom-xlarge" inline>
                    <Button secondary onClick={onBack}>
                      {t('button.back')}
                    </Button>
                    <Button
                      primary
                      onClick={onReview}
                      disabled={!canReview || isSubmitting}>
                      {t('button.review')}
                    </Button>
                  </ColumnButtons>
                </Column>
              </Grid>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};
