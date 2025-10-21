
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
import { TTransaction, TAmountWithConversions, getTransaction, TTransactionStatus, TTransactionType } from '@/api/account';
import { A } from '@/components/anchor/anchor';
import { Dialog } from '@/components/dialog/dialog';
import { Note } from './note';
import { Arrow } from './arrows';
import { TxStatusDetail } from './status';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { getTxSign } from '@/utils/transaction';
import { CopyableInput } from '@/components/copy/Copy';
import { parseTimeLong } from '@/utils/date';
import { ExternalLink, Info } from '@/components/icon';
import { Accordion } from '@/components/accordion/accordion';
import styles from './details-dialog-new.module.css';
import { Tooltip } from '@/components/tooltip/tooltip';

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

export const TxDetailsDialogNew = ({
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
  const { t, i18n } = useTranslation();
  const [transactionInfo, setTransactionInfo] = useState<TTransaction | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [displayOption, setDisplayOption] = useState<'coinBigger' | 'fiatBigger'>('coinBigger');
  const [alignment, setAlignment] = useState('center');
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

  const sign = transactionInfo && getTxSign(transactionInfo.type);
  const displayedSign = sign === '−' ? sign : '';

  const fromSignToText = () => {
    if (transactionInfo.type === 'send') {
      return 'Send';
    }

    if (transactionInfo.type === 'receive') {
      return 'Receive';
    }

    return 'Send to self';

  };

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
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.statusContainer}>
              <TxStatusDetail
                status={status}
                numConfirmations={numConfirmations}
                numConfirmationsComplete={numConfirmationsComplete}
              />
              <div className={styles.transferDirection}>
                <Arrow
                  status={status}
                  type={type}
                />
                <span>{fromSignToText()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: alignment, width: '100%' }}>
              {displayOption === 'coinBigger' ? (
                <>
                  <span className={styles.amount}>{displayedSign} <AmountWithUnit amount={amount} /></span>
                  <span className={styles.amountFiat}>{displayedSign}
                    <AmountWithUnit amount={transactionInfo.amountAtTime} convertToFiat />
                    <Tooltip
                      trigger={
                        <Info className={styles.infoIcon} width={15} />
                      }
                      content={<div className="text-center">Value in fiat when the transaction occured.</div>}
                    />
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.amount}>{displayedSign} <AmountWithUnit amount={transactionInfo.amountAtTime} convertToFiat />
                    {' '}
                    <Tooltip
                      trigger={
                        <Info className={styles.infoIcon} width={16} />
                      }
                      content={<div className="text-center">Value in fiat when the transaction occured.</div>}
                    />
                  </span>
                  <span className={styles.amountFiat}>{displayedSign}
                    <AmountWithUnit amount={amount} />
                  </span>
                </>
              )}

              <span className={styles.date}>
                {time ? parseTimeLong(time, i18n.language) : '---'}
              </span>
            </div>
          </div>
          <hr className={styles.separator} />
          <Note
            accountCode={accountCode}
            internalID={internalID}
            note={note}
          />
          {type && (
            <Row>
              <p className={styles.label}>{type === 'send' ? 'To' : 'From'}</p>
              <AddressOrTxId values={transactionInfo.addresses} />
            </Row>
          )}

          <Row>
            <p className={styles.label}>{t('transaction.fee')}</p>
            <span>{displayedSign} <AmountWithUnit amount={transactionInfo.fee} /></span>
          </Row>

          <Row>
            <div className={styles.withTooltip}>
              <p className={styles.label}>{t('Current Fiat')}</p>
              <Tooltip
                trigger={
                  <Info className={styles.infoIcon} width={14} />
                }
                content={<div className="text-center">Value in fiat at the current rate.</div>}
              />
            </div>
            <span>{displayedSign} <AmountWithUnit amount={transactionInfo.amount} convertToFiat /></span>
          </Row>

          <Row>
            <p className={styles.label}>{t('transaction.explorer')}</p>
            <AddressOrTxId values={[transactionInfo.internalID]} />
          </Row>

          <Accordion
            className={styles.advanced}
            title="Advanced"
            content={<div className={styles.advancedContent}>
              <Row>
                <p className={styles.label}>{t('transaction.confirmation')}</p>
                <span>{transactionInfo.numConfirmations}</span>
              </Row>
              <Row>
                <p className={styles.label}>{t('transaction.weight')}</p>
                <span>{transactionInfo.weight}</span>
              </Row>
              <Row>
                <p className={styles.label}>{t('transaction.vsize')}</p>
                <span>{transactionInfo.vsize}</span>
              </Row>
              <Row>
                <p className={styles.label}>{t('transaction.size')}</p>
                <span>{transactionInfo.size}</span>
              </Row>
            </div>}
            isOpen={isOpen}
            onToggle={() => setIsOpen(!isOpen)}
          />


          <div className={styles.explorerLinkContainer}>
            <A
              className={styles.explorerLink}
              href={explorerURL + transactionInfo.txID}
              title={`${t('transaction.explorerTitle')}\n${explorerURL}${transactionInfo.txID}`}>
              <ExternalLink width={14} />
              {' '}
              {t('transaction.explorerTitle')}
            </A>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => setDisplayOption('coinBigger')}>
                Bigger coin value font
              </button>
              <button onClick={() => setDisplayOption('fiatBigger')}>
                Bigger fiat value font
              </button>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => setAlignment('start')}>
                Align left
              </button>
              <button onClick={() => setAlignment('center')}>
                Align center
              </button>
              <button onClick={() => setAlignment('end')}>
                Align right
              </button>
            </div>
          </div>
        </div>

      )}
    </Dialog>
  );
};

const Row = ({ children }: {children: React.ReactNode}) => {
  return (
    <div className={styles.row}>
      {children}
    </div>
  );
};

const AddressOrTxId = ({ values }: {values: string[]}) => {
  return (
    <>
      {values.map((addrOrTxID) => (
        <CopyableInput
          key={addrOrTxID}
          alignRight
          borderLess
          flexibleHeight
          className={styles.copyableInputContainer}
          inputFieldClassName={styles.detailAddress}
          buttonClassName={styles.copyBtn}
          value={addrOrTxID}
          displayValue={`${addrOrTxID.slice(0, 8)}...${addrOrTxID.slice(-8)}`}
        />
      ))}
    </>
  );
};