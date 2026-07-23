// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount, TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Button, Checkbox } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { Skeleton } from '@/components/skeleton/skeleton';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { CONTENT_MIN_HEIGHT } from './constants';
import styles from './close-withdraw-funds.module.css';

type TProps = {
  balance?: TAmountWithConversions;
  btcAccounts: TAccount[];
  canClose: boolean;
  confirmed: boolean;
  destinationAccountCode: AccountCode;
  fee?: TAmountWithConversions;
  isClosing: boolean;
  onCancel: () => void;
  onClose: () => void;
  onConfirmChange: () => void;
  onDestinationAccountChange: (code: AccountCode) => void;
};

const AmountRow = ({
  amount,
}: {
  amount?: TAmountWithConversions;
}) => {
  if (!amount) {
    return <Skeleton />;
  }
  return (
    <div className={styles.amountRow}>
      <span className={`${styles.amountWithUnit || ''} ${styles.sats || ''}`}>
        <AmountWithUnit amount={amount} />
      </span>
      <span className={`${styles.amountWithUnit || ''} ${styles.fiat || ''}`}>
        <AmountWithUnit amount={amount} convertToFiat />
      </span>
    </div>
  );
};

export const CloseWithdrawConfirm = ({
  balance,
  btcAccounts,
  canClose,
  confirmed,
  destinationAccountCode,
  fee,
  isClosing,
  onCancel,
  onClose,
  onConfirmChange,
  onDestinationAccountChange,
}: TProps) => {
  const { t } = useTranslation();

  return (
    <View key="close-withdraw-funds" minHeight={CONTENT_MIN_HEIGHT} width="min(420px, 100%)">
      <ViewContent>
        <div className={styles.content}>
          <p className={styles.description}>{t('lightning.closeWithdrawFunds.description')}</p>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('lightning.closeWithdrawFunds.lightningBalanceToBeSent')}</h2>
            <AmountRow amount={balance} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('lightning.closeWithdrawFunds.accountDestination')}</h2>
            <GroupedAccountSelector
              accounts={btcAccounts}
              className={styles.accountSelector}
              disabled={isClosing}
              onChange={onDestinationAccountChange}
              selected={destinationAccountCode}
            />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('lightning.closeWithdrawFunds.fee')}</h2>
            <AmountRow amount={fee} />
          </section>

          <Checkbox
            className={styles.confirm}
            id="confirmCloseWithdrawFunds"
            checked={confirmed}
            disabled={isClosing}
            onChange={onConfirmChange}
          >
            {t('lightning.closeWithdrawFunds.confirm')}
          </Checkbox>
        </div>
      </ViewContent>
      <ViewButtons>
        <Button danger disabled={!canClose || isClosing} onClick={onClose}>
          {t('lightning.settings.closeAndWithdrawFunds')}
        </Button>
        <Button secondary disabled={isClosing} onClick={onCancel}>
          {t('dialog.cancel')}
        </Button>
      </ViewButtons>
    </View>
  );
};
