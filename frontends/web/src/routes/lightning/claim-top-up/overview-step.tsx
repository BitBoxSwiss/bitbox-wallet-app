// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions } from '@/api/account';
import type { TLightningPayment } from '@/api/lightning';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Button } from '@/components/forms';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { AmountBlock } from './amount-block';
import { CONTENT_MIN_HEIGHT } from './constants';
import styles from './claim-top-up.module.css';

type TAmountRowProps = {
  amount: TAmountWithConversions;
};

const AmountRow = ({ amount }: TAmountRowProps) => (
  <div className={styles.amountRow}>
    <AmountWithUnit
      alwaysShowAmounts
      amount={amount}
      amountClassName={styles.amount}
    />
    <AmountWithUnit
      alwaysShowAmounts
      amount={amount}
      convertToFiat
      amountClassName={styles.fiat}
      unitClassName={styles.fiat}
    />
  </div>
);

type TFeeActionProps = {
  amount?: TAmountWithConversions;
  buttonText: string;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

const FeeAction = ({
  amount,
  buttonText,
  danger,
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
      <AmountBlock amount={amount} label={label} />
      {button}
    </div>
  );
};

type TProps = {
  deposits: TLightningPayment[];
  onCancel: () => void;
  onClaim: () => void;
  onRefund: () => void;
};

export const ClaimTopUpOverview = ({
  deposits,
  onCancel,
  onClaim,
  onRefund,
}: TProps) => {
  const { t } = useTranslation();
  const hasDeposits = deposits.length > 0;

  return (
    <View key="claim-top-up" minHeight={CONTENT_MIN_HEIGHT}>
      <ViewContent>
        <div className={styles.content}>
          <div className={styles.description}>
            <p>{t('lightning.claimTopUp.description')}</p>
            <p>{t('lightning.claimTopUp.warning')}</p>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('lightning.claimTopUp.topUps')}</h2>
            {hasDeposits ? (
              <div className={styles.amountRows}>
                {deposits.map(deposit => (
                  <AmountRow
                    key={deposit.id}
                    amount={deposit.amount}
                  />
                ))}
              </div>
            ) : (
              <p>{t('lightning.claimTopUp.empty')}</p>
            )}
          </section>

          {/* TODO:Pass a fee to each FeeAction once the backend exposes
              claim/refund fee estimates.*/}
          <section className={styles.feeActions}>
            <FeeAction
              buttonText={t('lightning.claimTopUp.claimButton')}
              disabled={!hasDeposits}
              label={t('lightning.claimTopUp.claimFee')}
              onClick={onClaim}
            />
            <FeeAction
              buttonText={t('lightning.claimTopUp.refundButton')}
              danger
              disabled={!hasDeposits}
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
