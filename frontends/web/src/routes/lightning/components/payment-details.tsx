/**
 * Copyright 2024 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Payment as IPayment, LnPaymentDetails } from '@/api/lightning';
import { Dialog } from '@/components/dialog/dialog';
import { FiatConversion } from '@/components/rates/rates';
import { TxDetail } from '@/components/transactions/components/detail';
import { TxDateDetail } from '@/components/transactions/components/date';
import { TxDetailCopyableValues } from '@/components/transactions/components/address-or-txid';
import { toSat } from '@/utils/conversion';
import styles from '@/components/transactions/components/details.module.css';
import { getTxSign } from '@/utils/transaction';

type TTxDetailsDialog = {
  open: boolean;
  onClose: () => void;
  payment: IPayment;
  sign: string;
}

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
        <>
          <TxDetail label="Memo">
            {payment.description}
          </TxDetail>
          <TxDateDetail
            time={new Date(payment.paymentTime * 1000).toString()}
          />
          <TxDetail label="Amount">
            {toSat(payment.amountMsat)}
            {' '}
            sat
          </TxDetail>
          <TxDetail label={t('transaction.details.fiat')}>
            <span className={styles.fiat}>
              <FiatConversion
                amount={{
                  amount: `${toSat(payment.amountMsat)}`,
                  unit: 'sat',
                  estimated: false
                }}
                sign={sign}
                noAction
              />
            </span>
          </TxDetail>
          <TxDetail label="fee">
            {payment.feeMsat}
            {' '}
            msat
          </TxDetail>
          <TxDetail label="type">
            {payment.paymentType}
          </TxDetail>
          <TxDetail label="status">
            {payment.status}
          </TxDetail>
          { payment.paymentType !== 'closedChannel' && (
            <TxDetailCopyableValues
              key="paymentPreimage"
              label="paymentPreimage"
              values={[
                (payment.details.data as LnPaymentDetails).paymentPreimage
              ]}
            />
          )}
          { payment.paymentType !== 'closedChannel' && (
            <TxDetailCopyableValues
              key="paymentHash"
              label="paymentHash"
              values={[
                (payment.details.data as LnPaymentDetails).paymentHash
              ]}
            />
          )}
        </>
      )}
    </Dialog>
  );
};

type TTransactionDetails = {
  id: string | null;
  payment?: IPayment;
  onClose: () => void;
}

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
      sign={getTxSign(payment.paymentType === 'received' ? 'receive' : 'send')}
    />
  );
};
