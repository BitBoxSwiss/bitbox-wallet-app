/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021-2024 Shift Crypto AG
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { A } from '@/components/anchor/anchor';
import { Dialog } from '@/components/dialog/dialog';
import { CopyableInput } from '@/components/copy/Copy';
import { Warning, ExpandIcon } from '@/components/icon/icon';
import { ProgressRing } from '@/components/progressRing/progressRing';
import { FiatConversion } from '@/components/rates/rates';
import { Amount } from '@/components/amount/amount';
import { ArrowIn, ArrowOut, ArrowSelf } from './components/icons';
import { Note } from './note';
import { TxDetail } from './components/detail';
import parentStyle from './transactions.module.css';
import style from './transaction.module.css';

const parseTimeShort = (time: string, lang: string) => {
  const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  } as Intl.DateTimeFormatOptions;
  return new Date(Date.parse(time)).toLocaleString(lang, options);
};

type Props = {
  accountCode: accountApi.AccountCode;
  index: number;
  explorerURL: string;
} & accountApi.ITransaction;

export const Transaction = ({
  accountCode,
  index,
  internalID,
  explorerURL,
  type,
  amount,
  feeRatePerKb,
  numConfirmations,
  numConfirmationsComplete,
  time,
  addresses,
  status,
  note = '',
}: Props) => {
  const { i18n, t } = useTranslation();
  const [transactionDialog, setTransactionDialog] = useState<boolean>(false);
  const [transactionInfo, setTransactionInfo] = useState<accountApi.ITransaction>();

  const showDetails = () => {
    accountApi.getTransaction(accountCode, internalID).then(transaction => {
      if (!transaction) {
        console.error('Unable to retrieve transaction ' + internalID);
        return null;
      }
      setTransactionInfo(transaction);
      setTransactionDialog(true);
    })
      .catch(console.error);
  };

  const arrow = status === 'failed' ? (
    <Warning style={{ maxWidth: '18px' }} />
  ) : type === 'receive' ? (
    <ArrowIn />
  ) : type === 'send' ? (
    <ArrowOut />
  ) : (
    <ArrowSelf />
  );
  const sign = ((type === 'send') && '−') || ((type === 'receive') && '+') || '';
  const typeClassName = (status === 'failed' && style.failed) || (type === 'send' && style.send) || (type === 'receive' && style.receive) || '';
  const shortDate = time ? parseTimeShort(time, i18n.language) : '---';
  const statusText = t(`transaction.status.${status}`);
  const progress = numConfirmations < numConfirmationsComplete ? (numConfirmations / numConfirmationsComplete) * 100 : 100;

  return (
    <div className={`${style.container} ${index === 0 ? style.first : ''}`}>
      <div className={`${parentStyle.columns} ${style.row}`}>
        <div className={parentStyle.columnGroup}>
          <div className={parentStyle.type}>{arrow}</div>
          <div className={parentStyle.date}>
            <span className={style.columnLabel}>
              {t('transaction.details.date')}:
            </span>
            <span className={style.date}>{shortDate}</span>
          </div>
          { note ? (
            <div className={parentStyle.activity}>
              <span className={style.address}>
                {note}
              </span>
            </div>
          ) : (
            <div className={parentStyle.activity}>
              <span className={style.label}>
                {t(type === 'receive' ? 'transaction.tx.received' : 'transaction.tx.sent')}
              </span>
              <span className={style.address}>
                {addresses[0]}
                {addresses.length > 1 && (
                  <span className={style.badge}>
                    (+{addresses.length - 1})
                  </span>
                )}
              </span>
            </div>
          )}
          <div className={`${parentStyle.action} ${parentStyle.hideOnMedium}`}>
            <button type="button" className={style.action} onClick={showDetails}>
              <ExpandIcon expand={!transactionDialog} />
            </button>
          </div>
        </div>
        <div className={parentStyle.columnGroup}>
          <div className={parentStyle.status}>
            <span className={style.columnLabel}>
              {t('transaction.details.status')}:
            </span>
            <ProgressRing
              className="m-right-quarter"
              width={14}
              value={progress}
              isComplete={numConfirmations >= numConfirmationsComplete}
            />
            <span className={style.status}>{statusText}</span>
          </div>
          <div className={parentStyle.fiat}>
            <span className={`${style.fiat} ${typeClassName}`}>
              <FiatConversion amount={amount} sign={sign} noAction />
            </span>
          </div>
          <div className={`${parentStyle.currency} ${typeClassName}`}>
            <span
              className={`${style.amount} ${style.amountOverflow}`}
              data-unit={` ${amount.unit}`}>
              {sign}
              <Amount amount={amount.amount} unit={amount.unit}/>
              <span className={style.currencyUnit}>&nbsp;{amount.unit}</span>
            </span>
          </div>
          <div className={`${parentStyle.action} ${parentStyle.showOnMedium}`}>
            <button type="button" className={style.action} onClick={showDetails}>
              <ExpandIcon expand={!transactionDialog} />
            </button>
          </div>
        </div>
      </div>
      {/*
        Amount and Confirmations info are displayed using props data
        instead of transactionInfo because they are live updated.
      */}
      <Dialog
        open={transactionDialog}
        title={t('transaction.details.title')}
        onClose={() => setTransactionDialog(false)}
        slim
        medium>
        {transactionInfo && (
          <>
            <Note
              accountCode={accountCode}
              internalID={internalID}
              note={note}
            />
            <TxDetail label={t('transaction.details.type')}>{arrow}</TxDetail>
            <TxDetail label={t('transaction.confirmation')}>{numConfirmations}</TxDetail>
            <TxDetail label={t('transaction.details.status')}>
              <ProgressRing
                className="m-right-quarter"
                width={14}
                value={progress}
                isComplete={numConfirmations >= numConfirmationsComplete}
              />
              <span className={style.status}>
                {statusText} {
                  status === 'pending' && (
                    <span>({numConfirmations}/{numConfirmationsComplete})</span>
                  )
                }
              </span>
            </TxDetail>
            <TxDetail label={t('transaction.details.date')}>{shortDate}</TxDetail>
            <TxDetail label={t('transaction.details.fiat')}>
              <span className={`${style.fiat} ${typeClassName}`}>
                <FiatConversion amount={amount} sign={sign} noAction />
              </span>
            </TxDetail>
            <TxDetail label={t('transaction.details.fiatAtTime')}>
              <span className={`${style.fiat} ${typeClassName}`}>
                {transactionInfo.amountAtTime ?
                  <FiatConversion amount={transactionInfo.amountAtTime} sign={sign} noAction />
                  :
                  <FiatConversion noAction />
                }
              </span>
            </TxDetail>
            <TxDetail label={t('transaction.details.amount')}>
              <span className={`${style.amount} ${typeClassName}`}>
                {sign}
                <Amount amount={amount.amount} unit={amount.unit} />
              </span>
              {' '}
              <span className={`${style.currencyUnit} ${typeClassName}`}>{transactionInfo.amount.unit}</span>
            </TxDetail>
            {
              transactionInfo.fee && transactionInfo.fee.amount ? (
                <TxDetail
                  label={t('transaction.fee')}
                  title={feeRatePerKb.amount ? feeRatePerKb.amount + ' ' + feeRatePerKb.unit + '/Kb' : ''}
                >
                  <Amount amount={transactionInfo.fee.amount} unit={transactionInfo.fee.unit} />
                  {' '}
                  <span className={style.currencyUnit}>{transactionInfo.fee.unit}</span>
                </TxDetail>
              ) : (
                <TxDetail label={t('transaction.fee')}>---</TxDetail>
              )
            }
            <div className={`${style.detail} ${style.addresses}`}>
              <label>{t('transaction.details.address')}</label>
              <div className={style.detailAddresses}>
                { transactionInfo.addresses.map((address) => (
                  <CopyableInput
                    key={address}
                    alignRight
                    borderLess
                    flexibleHeight
                    className={style.detailAddress}
                    value={address} />
                )) }
              </div>
            </div>
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
                  <span className={style.currencyUnit}>WU</span>
                </TxDetail>
              ) : null
            }
            {
              transactionInfo.vsize ? (
                <TxDetail label={t('transaction.vsize')}>
                  {transactionInfo.vsize}
                  {' '}
                  <span className={style.currencyUnit}>b</span>
                </TxDetail>
              ) : null
            }
            {
              transactionInfo.size ? (
                <TxDetail label={t('transaction.size')}>
                  {transactionInfo.size}
                  {' '}
                  <span className={style.currencyUnit}>b</span>
                </TxDetail>
              ) : null
            }
            <div className={`${style.detail} ${style.addresses}`}>
              <label>{t('transaction.explorer')}</label>
              <div className={style.detailAddresses}>
                <CopyableInput
                  alignRight
                  borderLess
                  flexibleHeight
                  className={style.detailAddress}
                  value={transactionInfo.txID} />
              </div>
            </div>
            <div className={`${style.detail} flex-center`}>
              <A
                href={explorerURL + transactionInfo.txID}
                title={`${t('transaction.explorerTitle')}\n${explorerURL}${transactionInfo.txID}`}>
                {t('transaction.explorerTitle')}
              </A>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
};
