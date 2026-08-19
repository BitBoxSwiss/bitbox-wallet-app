// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount, TAmountWithConversions } from '@/api/account';
import { BackButton } from '@/components/backbutton/backbutton';
import { Button } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { Message } from '@/components/message/message';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { AmountBlock } from './amount-block';
import { CONTENT_MIN_HEIGHT, type TAction } from './constants';
import styles from './claim-top-up.module.css';

type TProps = {
  action: TAction;
  btcAccounts: TAccount[];
  canConfirm: boolean;
  errorMessage?: string;
  fee?: TAmountWithConversions;
  feeRateSatPerVbyte?: number;
  isSubmitting: boolean;
  refundDestinationAccountCode: AccountCode;
  refundUnavailable: boolean;
  topUpAmount?: TAmountWithConversions;
  onCancel: () => void;
  onConfirm: () => void;
  onRefundDestinationChange: (code: AccountCode) => void;
};

export const ClaimTopUpConfirm = ({
  action,
  btcAccounts,
  canConfirm,
  errorMessage,
  fee,
  feeRateSatPerVbyte,
  isSubmitting,
  refundDestinationAccountCode,
  refundUnavailable,
  topUpAmount,
  onCancel,
  onConfirm,
  onRefundDestinationChange,
}: TProps) => {
  const { t } = useTranslation();
  const isClaim = action === 'claim';

  return (
    <View key="claim-top-up-confirm" minHeight={CONTENT_MIN_HEIGHT}>
      <ViewHeader title={t(`lightning.claimTopUp.confirm.${isClaim ? 'claimTitle' : 'refundTitle'}`)} />
      <ViewContent>
        <div className={styles.content}>
          <Message hidden={!errorMessage} type="warning">
            {errorMessage}
          </Message>
          {!isClaim && (
            <div className={styles.refundDestination}>
              <span className={styles.blockLabel}>
                {t('lightning.claimTopUp.confirm.refundDestination')}
              </span>
              <GroupedAccountSelector
                accounts={btcAccounts}
                className={styles.accountSelector}
                disabled={isSubmitting}
                onChange={onRefundDestinationChange}
                selected={refundDestinationAccountCode}
              />
            </div>
          )}
          <AmountBlock
            amount={topUpAmount}
            label={t('lightning.claimTopUp.confirm.amount')}
          />
          <AmountBlock
            amount={fee}
            label={t(`lightning.claimTopUp.confirm.${isClaim ? 'fee' : 'feeRate'}`)}
          >
            {/* The SDK exposes refund fee rates before broadcast, not an exact refund fee amount. */}
            {refundUnavailable
              ? t('lightning.claimTopUp.refundUnavailable')
              : feeRateSatPerVbyte !== undefined
                ? t('lightning.claimTopUp.feeRate', { feeRate: feeRateSatPerVbyte })
                : undefined}
          </AmountBlock>
        </div>
      </ViewContent>
      <ViewButtons>
        {isClaim ? (
          <Button primary disabled={!canConfirm} onClick={onConfirm}>
            {t('lightning.claimTopUp.confirm.claimButton')}
          </Button>
        ) : (
          <Button danger disabled={!canConfirm} onClick={onConfirm}>
            {t('lightning.claimTopUp.confirm.refundButton')}
          </Button>
        )}
        <BackButton disabled={isSubmitting} onClick={onCancel}>
          {t('dialog.cancel')}
        </BackButton>
      </ViewButtons>
    </View>
  );
};
