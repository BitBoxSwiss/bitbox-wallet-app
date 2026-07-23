// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TLightningPayment } from '@/api/lightning';
import { A } from '@/components/anchor/anchor';
import { ExternalLink } from '@/components/icon';
import { Dialog } from '@/components/dialog/dialog';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Button } from '@/components/forms/button';
import { TxDetailRow } from '@/components/transactions/components/tx-detail-dialog/tx-detail-row';
import { parseTimeLongWithYear } from '@/utils/date';
import { getTxSign } from '@/utils/transaction';
import styles from '@/components/transactions/components/tx-detail-dialog/tx-detail-dialog.module.css';
import paymentStyles from './payment-details.module.css';

type TTxDetailsDialog = {
  open: boolean;
  onClose: () => void;
  payment: TLightningPayment;
  explorerURL?: string;
};

export const PaymentDetailsDialog = ({
  open,
  onClose,
  payment,
  explorerURL,
}: TTxDetailsDialog) => {
  const { i18n, t } = useTranslation();

  const typeText = payment.bitcoinDeposit
    ? t('lightning.bitcoinDeposit.label')
    : payment.type === 'receive' ? t('generic.received') : t('generic.sent');
  const sign = payment.amount.amount === '0' ? '' : getTxSign(payment.type);
  const statusText = payment.bitcoinDeposit && payment.bitcoinDeposit.state !== 'complete'
    ? t(`lightning.bitcoinDeposit.state.${payment.bitcoinDeposit.state}`)
    : t(`transaction.status.${payment.status}`, { context: payment.type });
  const txID = payment.bitcoinDeposit?.txid || payment.txId;

  return (
    <Dialog
      open={open}
      title={t('transaction.details.title')}
      onClose={onClose}
      slim
      medium>
      {payment && (
        <div className={styles.container}>
          {!payment.bitcoinDeposit && (
            <TxDetailRow>
              <p className={styles.label}>{t('lightning.send.confirm.note')}</p>
              <span>{payment.description || '-'}</span>
            </TxDetailRow>
          )}
          {(!payment.bitcoinDeposit || payment.time) && (
            <TxDetailRow>
              <p className={styles.label}>{t('transaction.details.date')}</p>
              <span>{payment.time ? parseTimeLongWithYear(payment.time, i18n.language) : '-'}</span>
            </TxDetailRow>
          )}
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
            <span>{statusText}</span>
          </TxDetailRow>
          {explorerURL && txID && (
            <div className={styles.explorerLinkContainer}>
              <A
                className={styles.explorerLink}
                href={explorerURL + txID}
                title={`${t('transaction.explorerTitle')}\n${explorerURL}${txID}`}>
                <ExternalLink />
                {' '}
                {t('transaction.explorerTitle')}
              </A>
            </div>
          )}
          {payment.bitcoinDeposit && (
            <>
              {payment.bitcoinDeposit.state === 'unclaimed' && (
                <Button className={paymentStyles.claimButton} primary>
                  {t('lightning.bitcoinDeposit.claim')}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
};

type TTransactionDetails = {
  id: string | null;
  payment?: TLightningPayment;
  explorerURL?: string;
  onClose: () => void;
};

export const PaymentDetails = ({
  id,
  payment,
  explorerURL,
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
      explorerURL={explorerURL}
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      payment={payment}
    />
  );
};
