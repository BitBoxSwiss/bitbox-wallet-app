// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount, TAmountWithConversions } from '@/api/account';
import { Button } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { AmountBlock } from './amount-block';
import { CONTENT_MIN_HEIGHT, type TAction } from './constants';
import styles from './claim-top-up.module.css';

type TProps = {
  action: TAction;
  btcAccounts: TAccount[];
  canConfirm: boolean;
  refundDestinationAccountCode: AccountCode;
  totalAmount: TAmountWithConversions;
  onCancel: () => void;
  onConfirm: () => void;
  onRefundDestinationChange: (code: AccountCode) => void;
};

export const ClaimTopUpConfirm = ({
  action,
  btcAccounts,
  canConfirm,
  refundDestinationAccountCode,
  totalAmount,
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
          {!isClaim && (
            <div className={styles.refundDestination}>
              <span className={styles.blockLabel}>
                {t('lightning.claimTopUp.confirm.refundDestination')}
              </span>
              <GroupedAccountSelector
                accounts={btcAccounts}
                className={styles.accountSelector}
                onChange={onRefundDestinationChange}
                selected={refundDestinationAccountCode}
              />
            </div>
          )}
          <AmountBlock
            amount={totalAmount}
            label={t('lightning.claimTopUp.confirm.totalAmount')}
          />
          {/* TODO: Pass a fee once the backend exposes a claim/refund estimate. */}
          <AmountBlock
            label={t('lightning.claimTopUp.confirm.fee')}
          />
        </div>
      </ViewContent>
      <ViewButtons>
        {/* TODO: Trigger the actual claim/refund once the backend exposes it. */}
        {isClaim ? (
          <Button primary onClick={onConfirm}>
            {t('lightning.claimTopUp.confirm.claimButton')}
          </Button>
        ) : (
          <Button danger disabled={!canConfirm} onClick={onConfirm}>
            {t('lightning.claimTopUp.confirm.refundButton')}
          </Button>
        )}
        <Button secondary onClick={onCancel}>
          {t('dialog.cancel')}
        </Button>
      </ViewButtons>
    </View>
  );
};
