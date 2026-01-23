// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { Accordion } from '@/components/accordion/accordion';
import { TTransaction } from '@/api/account';
import { useTranslation } from 'react-i18next';
import { TxDetailRow } from '@/components/transactions/components/tx-detail-dialog/tx-detail-row';
import styles from './tx-detail-dialog.module.css';

type Props = {
  transactionInfo: TTransaction;
};

export const AdvancedTxDetail = ({ transactionInfo }: Props) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Accordion
      className={styles.advanced}
      title={t('transaction.advanced')}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className={styles.advancedContent}>
        {
          !!transactionInfo.gas && (
            <TxDetailRow>
              <p className={styles.label}>{t('transaction.gas')}</p>
              <span>{transactionInfo.gas}</span>
            </TxDetailRow>
          )
        }
        {
          !!transactionInfo.nonce && (
            <TxDetailRow>
              <p className={styles.label}>Nonce</p>
              <span>{transactionInfo.nonce}</span>
            </TxDetailRow>
          )
        }
        {!!transactionInfo.numConfirmations && (
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.confirmation')}</p>
            <span>{transactionInfo.numConfirmations}</span>
          </TxDetailRow>
        ) }
        {!!transactionInfo.weight && (
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.weight')}</p>
            <div>
              <span>{transactionInfo.weight}</span>
              {' '}
              <span className={styles.unit}>WU</span>
            </div>
          </TxDetailRow>
        ) }
        {!!transactionInfo.vsize && (
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.vsize')}</p>
            <div>
              <span>{transactionInfo.vsize}</span>
              {' '}
              <span className={styles.unit}>b</span>
            </div>
          </TxDetailRow>
        ) }
        {!!transactionInfo.size && (
          <TxDetailRow>
            <p className={styles.label}>{t('transaction.size')}</p>
            <div>
              <span>{transactionInfo.size}</span>
              {' '}
              <span className={styles.unit}>b</span>
            </div>
          </TxDetailRow>
        ) }
      </div>
    </Accordion>
  );
};
