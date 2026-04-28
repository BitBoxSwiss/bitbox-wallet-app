// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TAmountWithConversions } from '@/api/account';
import { getBtcSatsAmount } from '@/api/coins';
import { TInputType, TInputTypeVariant, TLightningInvoice } from '@/api/lightning';
import { Amount } from '@/components/amount/amount';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Skeleton } from '@/components/skeleton/skeleton';
import { useMountedRef } from '@/hooks/mount';
import styles from '../send.module.css';

type TInvoiceDetailsProps = {
  invoice: TLightningInvoice;
};

const useInvoiceAmount = (amountSat?: number) => {
  const [invoiceAmount, setInvoiceAmount] = useState<TAmountWithConversions>();
  const mounted = useMountedRef();

  useEffect(() => {
    setInvoiceAmount(undefined);

    if (amountSat === undefined) {
      return;
    }

    void getBtcSatsAmount(amountSat.toString())
      .then((response) => {
        if (mounted.current && response.success) {
          setInvoiceAmount(response.amount);
        }
      })
      .catch(() => undefined);
  }, [amountSat, mounted]);

  return invoiceAmount;
};

const InvoiceDetails = ({ invoice }: TInvoiceDetailsProps) => {
  const { t } = useTranslation();
  const invoiceAmount = useInvoiceAmount(invoice.amountSat);

  return (
    <>
      <h1 className={styles.title}>{t('lightning.send.confirm.title')}</h1>
      <div className={styles.info}>
        <h2 className={styles.label}>{t('lightning.send.confirm.amount')}</h2>
        {invoiceAmount ? (
          <>
            <Amount amount={invoiceAmount.amount} unit={invoiceAmount.unit} />{' ' + invoiceAmount.unit}/{' '}
            <AmountWithUnit amount={invoiceAmount} convertToFiat/>
          </>
        ) : <Skeleton />}
      </div>
      {invoice.description && (
        <div className={styles.info}>
          <h2 className={styles.label}>{t('lightning.send.confirm.memo')}</h2>
          {invoice.description}
        </div>
      )}
    </>
  );
};

type TPaymentDetailsProps = {
  input: TInputType;
};

export const PaymentDetails = ({ input }: TPaymentDetailsProps) => {
  switch (input.type) {
  case TInputTypeVariant.BOLT11:
    return <InvoiceDetails invoice={input.invoice} />;
  }
};
