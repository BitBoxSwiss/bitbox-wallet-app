// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions } from '@/api/account';
import { getBtcSatAmount } from '@/api/coins';
import { type TLightningBitcoinAddress, type TLightningLNURLPay, type TPreparePaymentResponse } from '@/api/lightning';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Badge } from '@/components/badge/badge';
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

    getBtcSatAmount({ source: 'sat', amount: amountSat.toString() })
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

const satsAmount = (amountSat?: number): TAmountWithConversions | undefined => {
  if (amountSat === undefined) {
    return undefined;
  }
  return {
    amount: amountSat.toString(),
    unit: 'sat',
    estimated: false,
  };
};

type TPaymentFeeDetailsProps = {
  fees?: TPreparePaymentResponse;
  totalWithFiat?: boolean;
};

type TPaymentAmountDetailsProps = {
  amountSat?: number;
};

type TPaymentNoteDetailsProps = {
  description?: string;
};

type TBolt11PaymentDetailsProps = {
  description?: string;
  fees: TPreparePaymentResponse;
};

type TLNURLPayRecipientDetailsProps = {
  lnurlPay: TLightningLNURLPay;
};

type TBitcoinAddressRecipientDetailsProps = {
  bitcoinAddress: TLightningBitcoinAddress;
};

export const BitcoinAddressRecipientDetails = ({ bitcoinAddress }: TBitcoinAddressRecipientDetailsProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.info}>
      <h2 className={`${styles.label || ''} ${styles.receiverLabel || ''}`}>
        {t('lightning.send.confirm.receiver')}
        <Badge className={styles.receiverBadge} type="info">
          {t('lightning.send.onChain')}
        </Badge>
      </h2>
      <div className={styles.address}>{bitcoinAddress.address}</div>
    </div>
  );
};

export const PaymentAmountDetails = ({ amountSat }: TPaymentAmountDetailsProps) => {
  const { t } = useTranslation();
  const invoiceAmount = useInvoiceAmount(amountSat);

  return (
    <div className={styles.info}>
      <h2 className={styles.label}>{t('lightning.send.confirm.amount')}</h2>
      <AmountValue amount={invoiceAmount} showFiat />
    </div>
  );
};

export const PaymentNoteDetails = ({ description }: TPaymentNoteDetailsProps) => {
  const { t } = useTranslation();

  if (!description) {
    return null;
  }

  return (
    <div className={styles.info}>
      <h2 className={styles.label}>{t('lightning.send.confirm.note')}</h2>
      {description}
    </div>
  );
};

export const PaymentFeeDetails = ({ fees, totalWithFiat = false }: TPaymentFeeDetailsProps) => {
  const { t } = useTranslation();
  const feeAmount = satsAmount(fees?.feeSat);
  const totalDebitAmountSat = satsAmount(fees?.totalDebitSat);
  const convertedTotalDebitAmount = useInvoiceAmount(totalWithFiat ? fees?.totalDebitSat : undefined);
  const totalDebitAmount = totalWithFiat ? convertedTotalDebitAmount || totalDebitAmountSat : totalDebitAmountSat;
  const showTotalFiat = totalWithFiat && convertedTotalDebitAmount !== undefined;

  return (
    <>
      <div className={styles.info}>
        <h2 className={styles.label}>{t('send.fee.label')}</h2>
        <AmountValue amount={feeAmount} />
      </div>
      <div className={styles.info}>
        <h2 className={styles.label}>{t('send.confirm.total')}</h2>
        <AmountValue amount={totalDebitAmount} showFiat={showTotalFiat} />
      </div>
    </>
  );
};

export const LNURLPayRecipientDetails = ({ lnurlPay }: TLNURLPayRecipientDetailsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <h1 className={styles.title}>{t('lightning.send.confirm.title')}</h1>
      <div className={styles.info}>
        <h2 className={styles.label}>{t('send.confirm.to')}</h2>
        {lnurlPay.address || lnurlPay.domain}
      </div>
      <PaymentNoteDetails description={lnurlPay.description} />
    </>
  );
};

export const Bolt11PaymentDetails = ({ description, fees }: TBolt11PaymentDetailsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <h1 className={styles.title}>{t('lightning.send.confirm.title')}</h1>
      <PaymentAmountDetails amountSat={fees.amountSat} />
      <PaymentNoteDetails description={description} />
      <PaymentFeeDetails fees={fees} totalWithFiat />
    </>
  );
};
