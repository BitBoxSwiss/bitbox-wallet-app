// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount } from '@/api/account';
import { Amount } from '@/components/amount/amount';
import { Button, Checkbox } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import {
  CONTENT_MIN_HEIGHT,
  MOCK_AMOUNT_UNIT,
  MOCK_FIAT_UNIT,
  MOCK_LIGHTNING_BALANCE,
  MOCK_WITHDRAW_FEE,
  type TDisplayAmount,
} from './constants';
import styles from './close-withdraw-funds.module.css';

type TProps = {
  btcAccounts: TAccount[];
  canClose: boolean;
  confirmed: boolean;
  destinationAccountCode: AccountCode;
  onCancel: () => void;
  onClose: () => void;
  onConfirmChange: () => void;
  onDestinationAccountChange: (code: AccountCode) => void;
};

const AmountRow = ({
  amount,
}: {
  amount: TDisplayAmount;
}) => (
  <div className={styles.amountRow}>
    <span className={`${styles.amountWithUnit || ''} ${styles.sats || ''}`}>
      <Amount amount={amount.amount} unit={MOCK_AMOUNT_UNIT} /> {MOCK_AMOUNT_UNIT}
    </span>
    <span className={`${styles.amountWithUnit || ''} ${styles.fiat || ''}`}>
      <Amount amount={amount.fiatAmount} unit={MOCK_FIAT_UNIT} /> {MOCK_FIAT_UNIT}
    </span>
  </div>
);

export const CloseWithdrawConfirm = ({
  btcAccounts,
  canClose,
  confirmed,
  destinationAccountCode,
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
            <AmountRow amount={MOCK_LIGHTNING_BALANCE} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('lightning.closeWithdrawFunds.accountDestination')}</h2>
            <GroupedAccountSelector
              accounts={btcAccounts}
              className={styles.accountSelector}
              onChange={onDestinationAccountChange}
              selected={destinationAccountCode}
            />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('lightning.closeWithdrawFunds.fee')}</h2>
            <AmountRow amount={MOCK_WITHDRAW_FEE} />
          </section>

          <Checkbox
            className={styles.confirm}
            id="confirmCloseWithdrawFunds"
            checked={confirmed}
            onChange={onConfirmChange}
          >
            {t('lightning.closeWithdrawFunds.confirm')}
          </Checkbox>
        </div>
      </ViewContent>
      <ViewButtons>
        <Button danger disabled={!canClose} onClick={onClose}>
          {t('lightning.settings.closeAndWithdrawFunds')}
        </Button>
        <Button secondary onClick={onCancel}>
          {t('dialog.cancel')}
        </Button>
      </ViewButtons>
    </View>
  );
};
