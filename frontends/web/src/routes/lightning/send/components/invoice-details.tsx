// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TAmountWithConversions } from '@/api/account';
import { getBtcSatsAmount } from '@/api/coins';
import { TPaymentInputType, TPreparePaymentResponse } from '@/api/lightning';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Skeleton } from '@/components/skeleton/skeleton';
import { useMountedRef } from '@/hooks/mount';
import styles from '../send.module.css';

const useInvoiceAmount = (amountSat?: number) => {
  const [invoiceAmount, setInvoiceAmount] = useState<TAmountWithConversions>();
  const mounted = useMountedRef();

  useEffect(() => {
    setInvoiceAmount(undefined);

    if (amountSat === undefined) {
      return;
    }

    getBtcSatsAmount(amountSat.toString())
      .then((response) => {
        if (mounted.current && response.success) {
          setInvoiceAmount(response.amount);
        }
      })
      .catch(() => undefined);
  }, [amountSat, mounted]);

  return invoiceAmount;
};

type TAmountValueProps = {
  amount?: TAmountWithConversions;
  showFiat?: boolean;
};

const AmountValue = ({ amount, showFiat = false }: TAmountValueProps) => {
  if (!amount) {
    return <Skeleton />;
  }

  return (
    <span className={styles.amountLine}>
      <AmountWithUnit amount={amount} alwaysShowAmounts />
      {showFiat && (
        <>
          {' / '}
          <AmountWithUnit amount={amount} alwaysShowAmounts convertToFiat />
        </>
      )}
    </span>
  );
};

type TPaymentDetailsProps = {
  input: TPaymentInputType;
  quote: TPreparePaymentResponse;
};

export const PaymentDetails = ({ input, quote }: TPaymentDetailsProps) => {
  const { t } = useTranslation();
  const { invoice } = input;
  const invoiceAmount = useInvoiceAmount(quote.amountSat);
  const feeAmount = useInvoiceAmount(quote.feeSat);
  const totalDebitAmount = useInvoiceAmount(quote.totalDebitSat);

  return (
    <>
      <h1 className={styles.title}>{t('lightning.send.confirm.title')}</h1>
      <div className={styles.info}>
        <h2 className={styles.label}>{t('lightning.send.confirm.amount')}</h2>
        <AmountValue amount={invoiceAmount} showFiat />
      </div>
      {invoice.description && (
        <div className={styles.info}>
          <h2 className={styles.label}>{t('lightning.send.confirm.memo')}</h2>
          {invoice.description}
        </div>
      )}
      <div className={styles.info}>
        <h2 className={styles.label}>{t('send.fee.label')}</h2>
        <AmountValue amount={feeAmount} />
      </div>
      <div className={styles.info}>
        <h2 className={styles.label}>{t('send.confirm.total')}</h2>
        <AmountValue amount={totalDebitAmount} showFiat />
      </div>
    </>
  );
};
