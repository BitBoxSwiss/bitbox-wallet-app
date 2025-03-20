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
import { ITransaction, IAmount, getTransaction, TTransactionStatus, TTransactionType } from '@/api/account';
import { A } from '@/components/anchor/anchor';
import { Dialog } from '@/components/dialog/dialog';
import { FiatConversion } from '@/components/rates/rates';
import { Amount } from '@/components/amount/amount';
import { Note } from './note';
import { TxDetail } from './detail';
import { Arrow } from './arrows';
import { TxDateDetail } from './date';
import { TxStatusDetail } from './status';
import { TxDetailCopyableValues } from './address-or-txid';
import styles from './details.module.css';

type TProps = {
  open: boolean;
  onClose: () => void;
  accountCode: string;
  internalID: string;
  note: string;
  status: TTransactionStatus;
  type: TTransactionType;
  numConfirmations: number;
  numConfirmationsComplete: number;
  time: string | null;
  amount: IAmount;
  sign: string;
  explorerURL: string;
}

export const TxDetailsDialog = ({
  open,
  onClose,
  accountCode,
  internalID,
  note,
  status,
  type,
  numConfirmations,
  numConfirmationsComplete,
  time,
  amount,
  sign,
  explorerURL,
}: TProps) => {
  const { t } = useTranslation();

  const [transactionInfo, setTransactionInfo] = useState<ITransaction | null>(null);

  useEffect(() => {
    if (!transactionInfo && open) {
      getTransaction(accountCode, internalID).then(transaction => {
        if (!transaction) {
          console.error(`Unable to retrieve transaction ${internalID}`);
        }
        setTransactionInfo(transaction);
      }).catch(console.error);
    }
  }, [accountCode, internalID, open, transactionInfo]);

  if (transactionInfo === null) {
    return;
  }

  // Amount and Confirmations info are displayed using props data
  // instead of transactionInfo because they are live updated.
  return (
    <Dialog
      open={open && !!transactionInfo}
      title={t('transaction.details.title')}
      onClose={onClose}
      slim
      medium>
      {transactionInfo && (
        <>
          <Note
            accountCode={accountCode}
            internalID={internalID}
            note={note}
          />
          <TxDetail label={t('transaction.details.type')}>
            <Arrow
              status={status}
              type={type}
            />
          </TxDetail>
          <TxDetail label={t('transaction.confirmation')}>{numConfirmations}</TxDetail>
          <TxStatusDetail
            status={status}
            numConfirmations={numConfirmations}
            numConfirmationsComplete={numConfirmationsComplete}
          />
          <TxDateDetail time={time} />
          <TxDetail label={t('transaction.details.fiat')}>
            <span className={styles.fiat}>
              <FiatConversion amount={amount} sign={sign} noAction />
            </span>
          </TxDetail>
          <TxDetail label={t('transaction.details.fiatAtTime')}>
            <span className={styles.fiat}>
              {transactionInfo.amountAtTime?.estimated === false ?
                <FiatConversion amount={transactionInfo.amountAtTime} sign={sign} noAction />
                :
                <FiatConversion noAction />
              }
            </span>
          </TxDetail>
          <TxDetail label={t('transaction.details.amount')}>
            <span className={styles.amount}>
              {sign}
              <Amount amount={amount.amount} unit={amount.unit} />
            </span>
            {' '}
            <span className={styles.currencyUnit}>{transactionInfo.amount.unit}</span>
          </TxDetail>
          {
            transactionInfo.fee && transactionInfo.fee.amount ? (
              <TxDetail label={t('transaction.fee')}>
                <Amount amount={transactionInfo.fee.amount} unit={transactionInfo.fee.unit} />
                {' '}
                <span className={styles.currencyUnit}>{transactionInfo.fee.unit}</span>
              </TxDetail>
            ) : (
              <TxDetail label={t('transaction.fee')}>---</TxDetail>
            )
          }
          <TxDetailCopyableValues
            label={t('transaction.details.address')}
            values={transactionInfo.addresses}
          />
          {
            transactionInfo.gas ? (
              <TxDetail label={t('transaction.gas')}>{transactionInfo.gas}</TxDetail>
            ) : null
          }
          {
            transactionInfo.nonce ? (
              <TxDetail label="Nonce">{transactionInfo.nonce}</TxDetail>
            ) : null
          }
          {
            transactionInfo.weight ? (
              <TxDetail label={t('transaction.weight')}>
                {transactionInfo.weight}
                {' '}
                <span className={styles.currencyUnit}>WU</span>
              </TxDetail>
            ) : null
          }
          {
            transactionInfo.vsize ? (
              <TxDetail label={t('transaction.vsize')}>
                {transactionInfo.vsize}
                {' '}
                <span className={styles.currencyUnit}>b</span>
              </TxDetail>
            ) : null
          }
          {
            transactionInfo.size ? (
              <TxDetail label={t('transaction.size')}>
                {transactionInfo.size}
                {' '}
                <span className={styles.currencyUnit}>b</span>
              </TxDetail>
            ) : null
          }
          <TxDetailCopyableValues
            label={t('transaction.explorer')}
            values={[transactionInfo.txID]}
          />
          <div className={`${styles.detail} flex-center`}>
            <A
              href={explorerURL + transactionInfo.txID}
              title={`${t('transaction.explorerTitle')}\n${explorerURL}${transactionInfo.txID}`}>
              {t('transaction.explorerTitle')}
            </A>
          </div>
        </>
      )}
    </Dialog>
  );
};
