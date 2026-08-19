// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount, TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { BackButton } from '@/components/backbutton/backbutton';
import { Button, Checkbox } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { Message } from '@/components/message/message';
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
  hasIncoming: boolean;
  incoming?: TAmountWithConversions;
  incomingConfirmed: boolean;
  isClosing: boolean;
  onCancel: () => void;
  onClose: () => void;
  onConfirmChange: () => void;
  onIncomingConfirmChange: () => void;
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
  hasIncoming,
  incoming,
  incomingConfirmed,
  isClosing,
  onCancel,
  onClose,
  onConfirmChange,
  onIncomingConfirmChange,
  onDestinationAccountChange,
}: TProps) => {
  const { t } = useTranslation();

  return (
    <View key="close-withdraw-funds" minHeight={CONTENT_MIN_HEIGHT}>
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

          {hasIncoming && (
            <Message type="warning">
              {t('lightning.closeWithdrawFunds.incomingWarning')}
              {incoming && (
                <>
                  <br />
                  {t('lightning.closeWithdrawFunds.incomingFunds')}:&nbsp;
                  <AmountWithUnit amount={incoming} maxDecimals={9} />
                  {' / '}
                  <AmountWithUnit amount={incoming} convertToFiat />
                </>
              )}
              <Checkbox
                className={styles.incomingConfirm}
                id="confirmIncomingFunds"
                checked={incomingConfirmed}
                disabled={isClosing}
                onChange={onIncomingConfirmChange}
              >
                {t('lightning.closeWithdrawFunds.incomingWarningConfirm')}
              </Checkbox>
            </Message>
          )}

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
        <BackButton disabled={isClosing} onClick={onCancel}>
          {t('dialog.cancel')}
        </BackButton>
      </ViewButtons>
    </View>
  );
};
