// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Payment as IPayment } from '@/api/lightning';
import { PaymentStatus, PaymentType } from '@/api/lightning';
import { Dialog } from '@/components/dialog/dialog';
import { getTxSign } from '@/utils/transaction';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { TxDetailRow } from '@/components/transactions/components/tx-detail-dialog/tx-detail-row';
import { AddressOrTxId } from '@/components/transactions/components/tx-detail-dialog/address-or-tx-id';
import styles from '@/components/transactions/components/tx-detail-dialog/tx-detail-dialog.module.css';

type TTxDetailsDialog = {
  open: boolean;
  onClose: () => void;
  payment: IPayment;
  sign: string;
};

export const PaymentDetailsDialog = ({
  open,
  onClose,
  payment,
  sign,
}: TTxDetailsDialog) => {
  const { t } = useTranslation();

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
            <p className={styles.label}>Memo</p>
            <span>{payment.description || '-'}</span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.details.date')}</p>
            <span>{payment.timestamp ? new Date(payment.timestamp * 1000).toString() : '-'}</span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>Amount</p>
            <span>{payment.amountSat} sat</span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.details.fiat')}</p>
            <span>
              <AmountWithUnit
                amount={{
                  amount: `${payment.amountSat}`,
                  unit: 'sat',
                  estimated: false
                }}
                sign={sign}
                convertToFiat
              />
            </span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>Fee</p>
            <span>{payment.feesSat} sat</span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>Type</p>
            <span>{payment.paymentType === PaymentType.RECEIVE ? 'receive' : 'send'}</span>
          </TxDetailRow>
          <TxDetailRow>
            <p className={styles.label}>Status</p>
            <span>{payment.status === PaymentStatus.COMPLETED ? 'complete' : payment.status === PaymentStatus.FAILED ? 'failed' : 'pending'}</span>
          </TxDetailRow>
          {payment.paymentPreimage && (
            <TxDetailRow>
              <p className={styles.label}>Preimage</p>
              <AddressOrTxId values={[payment.paymentPreimage]} />
            </TxDetailRow>
          )}
          {payment.paymentHash && (
            <TxDetailRow>
              <p className={styles.label}>Payment Hash</p>
              <AddressOrTxId values={[payment.paymentHash]} />
            </TxDetailRow>
          )}
        </div>
      )}
    </Dialog>
  );
};

type TTransactionDetails = {
  id: string | null;
  payment?: IPayment;
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
      sign={getTxSign(payment.paymentType === PaymentType.RECEIVE ? 'receive' : 'send')}
    />
  );
};
