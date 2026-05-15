// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TLightningPayment } from '@/api/lightning';
import { Dialog } from '@/components/dialog/dialog';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { TxDetailRow } from '@/components/transactions/components/tx-detail-dialog/tx-detail-row';
import { parseTimeLongWithYear } from '@/utils/date';
import { getTxSign } from '@/utils/transaction';
import styles from '@/components/transactions/components/tx-detail-dialog/tx-detail-dialog.module.css';

type TTxDetailsDialog = {
  open: boolean;
  onClose: () => void;
  payment: TLightningPayment;
};

export const PaymentDetailsDialog = ({
  open,
  onClose,
  payment,
}: TTxDetailsDialog) => {
  const { i18n, t } = useTranslation();

  const typeText = payment.type === 'receive' ? t('generic.received') : t('generic.sent');
  const sign = payment.amount.amount === '0' ? '' : getTxSign(payment.type);

  return (
    <Dialog
      open={open}
      title={t('transaction.details.title')}
      onClose={onClose}
      slim
      medium>
      {payment && (
        <div className={styles.container}>
          <TxDetailRow>
            <p className={styles.label}>{t('lightning.send.confirm.memo')}</p>
            <span>{payment.description || '-'}</span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.details.date')}</p>
            <span>{payment.time ? parseTimeLongWithYear(payment.time, i18n.language) : '-'}</span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.details.amount')}</p>
            <span>
              <AmountWithUnit
                amount={payment.amount}
                unitClassName={styles.rowUnit}
              />
            </span>
          </TxDetailRow>
          {payment.type === 'send' && (
            <TxDetailRow>
              <p className={styles.label}>{t('transaction.fee')}</p>
              <span>
                <AmountWithUnit
                  amount={payment.fee}
                  unitClassName={styles.rowUnit}
                />
              </span>
            </TxDetailRow>
          )}
          {!payment.amountAtTime.estimated && (
            <TxDetailRow>
              <p className={styles.label}>{t('transaction.details.historicalValue')}</p>
              <span>
                <AmountWithUnit
                  amount={payment.amountAtTime}
                  convertToFiat
                  sign={sign}
                  unitClassName={styles.rowUnit}
                />
              </span>
            </TxDetailRow>
          )}
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.details.currentValue')}</p>
            <span>
              <AmountWithUnit
                amount={payment.amount}
                convertToFiat
                sign={sign}
                unitClassName={styles.rowUnit}
              />
            </span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.details.type')}</p>
            <span>{typeText}</span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.details.status')}</p>
            <span>{t(`transaction.status.${payment.status}`, { context: payment.type })}</span>
          </TxDetailRow>
        </div>
      )}
    </Dialog>
  );
};

type TTransactionDetails = {
  id: string | null;
  payment?: TLightningPayment;
  onClose: () => void;
};

export const PaymentDetails = ({
  id,
  payment,
  onClose,
}: TTransactionDetails) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (id) {
      setOpen(true);
    }
  }, [id]);

  if (!payment) {
    return null;
  }

  return (
    <PaymentDetailsDialog
      open={open}
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      payment={payment}
    />
  );
};
