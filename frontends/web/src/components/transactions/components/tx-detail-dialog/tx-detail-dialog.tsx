// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TTransaction, TAmountWithConversions, getTransaction, TTransactionStatus, TTransactionType } from '@/api/account';
import { A } from '@/components/anchor/anchor';
import { Dialog } from '@/components/dialog/dialog';
import { Note } from './note';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { getTxSignForTxDetail } from '@/utils/transaction';
import { ExternalLink } from '@/components/icon';
import { TxDetailHeader } from '@/components/transactions/components/tx-detail-dialog/tx-detail-header';
import { AdvancedTxDetail } from '@/components/transactions/components/tx-detail-dialog/advanced-tx-detail';
import { TxDetailRow } from '@/components/transactions/components/tx-detail-dialog/tx-detail-row';
import { AddressOrTxId } from '@/components/transactions/components/tx-detail-dialog/address-or-tx-id';
import styles from './tx-detail-dialog.module.css';

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
  amount: TAmountWithConversions;
  explorerURL: string;
};

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
  explorerURL,
}: TProps) => {
  const { t } = useTranslation();
  const [transactionInfo, setTransactionInfo] = useState<TTransaction | null>(null);

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

  const displayedSign = getTxSignForTxDetail(transactionInfo.type);
  const amountSign = amount.amount === '0' ? '' : displayedSign;
  const amountAtTimeSign = transactionInfo.amountAtTime?.amount === '0' ? '' : displayedSign;
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
        <div className={styles.container} data-testid="tx-details-container" >
          <TxDetailHeader
            status={status}
            numConfirmations={numConfirmations}
            numConfirmationsComplete={numConfirmationsComplete}
            type={type}
            amount={amount}
            transactionInfo={transactionInfo}
            time={time}
            amountSign={amountSign}
            amountAtTimeSign={amountAtTimeSign}
          />

          <hr className={styles.separator} />

          <Note
            accountCode={accountCode}
            internalID={internalID}
            note={note}
          />

          {/* to or send address */}
          <TxDetailRow>
            <p className={styles.label}>{type === 'receive' ? t('transaction.details.from') : t('send.confirm.to')}</p>
            <AddressOrTxId values={transactionInfo.addresses} />
          </TxDetailRow>

          {/* fee */}
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.fee')}</p>
            <span><AmountWithUnit amount={transactionInfo.fee} unitClassName={styles.rowUnit} /></span>
          </TxDetailRow>


          {/* historical fiat */}
          {transactionInfo.amountAtTime?.estimated === false && (
            <TxDetailRow>
              <div>
                <p className={styles.label}>{t('transaction.details.historicalFiat')}</p>
              </div>
              <span>
                <AmountWithUnit
                  amount={transactionInfo.amountAtTime}
                  convertToFiat
                  unitClassName={styles.rowUnit}
                />
              </span>
            </TxDetailRow>
          )}


          {/* current fiat */}
          <TxDetailRow>
            <div>
              <p className={styles.label}>{t('transaction.details.currentFiat')}</p>
            </div>
            <span>
              <AmountWithUnit
                amount={amount}
                convertToFiat
                unitClassName={styles.rowUnit}
              />
            </span>
          </TxDetailRow>

          {/* tx id */}
          <TxDetailRow>
            <p className={`
              ${styles.label || ''}
              ${styles.nowrap || ''}
            `}>{t('transaction.explorer')}</p>
            <AddressOrTxId values={[transactionInfo.internalID]} />
          </TxDetailRow>

          <AdvancedTxDetail transactionInfo={transactionInfo} />

          {/* explorer link */}
          <div className={styles.explorerLinkContainer}>
            <A
              className={styles.explorerLink}
              href={explorerURL + transactionInfo.txID}
              title={`${t('transaction.explorerTitle')}\n${explorerURL}${transactionInfo.txID}`}>
              <ExternalLink />
              {' '}
              {t('transaction.explorerTitle')}
            </A>
          </div>
        </div>

      )}
    </Dialog>
  );
};
