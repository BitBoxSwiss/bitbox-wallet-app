// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions } from '@/api/account';
import type { TLightningPayment } from '@/api/lightning';
import { Button } from '@/components/forms';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { AmountBlock } from './amount-block';
import { CONTENT_MIN_HEIGHT } from './constants';
import styles from './claim-top-up.module.css';

type TFeeActionProps = {
  amount?: TAmountWithConversions;
  buttonText: string;
  danger?: boolean;
  detail?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

const FeeAction = ({
  amount,
  buttonText,
  danger,
  detail,
  disabled,
  label,
  onClick,
}: TFeeActionProps) => {
  const button = danger ? (
    <Button
      className={styles.actionButton}
      danger
      disabled={disabled}
      onClick={onClick}>
      {buttonText}
    </Button>
  ) : (
    <Button
      className={styles.actionButton}
      disabled={disabled}
      onClick={onClick}
      primary>
      {buttonText}
    </Button>
  );

  return (
    <div className={styles.feeRow}>
      <AmountBlock amount={amount} label={label}>
        {detail}
      </AmountBlock>
      {button}
    </div>
  );
};

type TProps = {
  canClaim: boolean;
  claimFee?: TAmountWithConversions;
  deposit: TLightningPayment | null;
  canRefund: boolean;
  refundFeeRateSatPerVbyte?: number;
  refundUnavailable: boolean;
  onCancel: () => void;
  onClaim: () => void;
  onRefund: () => void;
};

export const ClaimTopUpOverview = ({
  canClaim,
  claimFee,
  deposit,
  canRefund,
  refundFeeRateSatPerVbyte,
  refundUnavailable,
  onCancel,
  onClaim,
  onRefund,
}: TProps) => {
  const { t } = useTranslation();
  const hasDeposit = !!deposit;

  return (
    <View key="claim-top-up" minHeight={CONTENT_MIN_HEIGHT}>
      <ViewContent>
        <div className={styles.content}>
          <div className={styles.description}>
            <p>{t('lightning.claimTopUp.description')}</p>
            <p>{t('lightning.claimTopUp.warning')}</p>
          </div>

          <section className={styles.section}>
            {hasDeposit ? (
              <AmountBlock
                amount={deposit.amount}
                label={t('lightning.claimTopUp.topUp')}
              />
            ) : (
              <>
                <h2 className={styles.sectionTitle}>{t('lightning.claimTopUp.topUp')}</h2>
                <p>{t('lightning.claimTopUp.empty')}</p>
              </>
            )}
          </section>

          <section className={styles.feeActions}>
            <FeeAction
              amount={claimFee}
              buttonText={t('lightning.claimTopUp.claimButton')}
              detail={hasDeposit && !canClaim ? t('lightning.claimTopUp.claimUnavailable') : undefined}
              disabled={!hasDeposit || !canClaim}
              label={t('lightning.claimTopUp.claimFee')}
              onClick={onClaim}
            />
            <FeeAction
              buttonText={t('lightning.claimTopUp.refundButton')}
              danger
              detail={refundUnavailable
                ? t('lightning.claimTopUp.refundUnavailable')
                : refundFeeRateSatPerVbyte !== undefined
                  ? t('lightning.claimTopUp.feeRate', { feeRate: refundFeeRateSatPerVbyte })
                  : undefined}
              disabled={!hasDeposit || !canRefund}
              label={t('lightning.claimTopUp.refundFee')}
              onClick={onRefund}
            />
          </section>
        </div>
      </ViewContent>
      <ViewButtons>
        <Button secondary onClick={onCancel}>
          {t('dialog.cancel')}
        </Button>
      </ViewButtons>
    </View>
  );
};
