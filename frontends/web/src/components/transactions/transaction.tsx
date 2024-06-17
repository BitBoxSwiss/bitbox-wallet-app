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
import * as accountApi from '../../api/account';
import { A } from '../anchor/anchor';
import { Dialog } from '../dialog/dialog';
import { CopyableInput } from '../copy/Copy';
import { Warning, ExpandIcon } from '../icon/icon';
import { ProgressRing } from '../progressRing/progressRing';
import { FiatConversion } from '../rates/rates';
import { Amount } from '../../components/amount/amount';
import { ArrowIn, ArrowOut, ArrowSelf } from './components/icons';
import { Note } from './note';
import parentStyle from './transactions.module.css';
import style from './transaction.module.css';

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

  const parseTimeShort = (time: string) => {
    const options = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    } as Intl.DateTimeFormatOptions;
    return new Date(Date.parse(time)).toLocaleString(i18n.language, options);
  };

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
  const shortDate = time ? parseTimeShort(time) : '---';
  const statusText = t(`transaction.status.${status}`);
  const progress = numConfirmations < numConfirmationsComplete ? (numConfirmations / numConfirmationsComplete) * 100 : 100;

  return (
    <div className={[style.container, index === 0 ? style.first : ''].join(' ')}>
      <div className={[parentStyle.columns, style.row].join(' ')}>
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
          <div className={[parentStyle.action, parentStyle.hideOnMedium].join(' ')}>
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
          <div className={[parentStyle.action, parentStyle.showOnMedium].join(' ')}>
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
            <div className={style.detail}>
              <label>{t('transaction.details.type')}</label>
              <p>{arrow}</p>
            </div>
            <div className={style.detail}>
              <label>{t('transaction.confirmation')}</label>
              <p>{numConfirmations}</p>
            </div>
            <div className={style.detail}>
              <label>{t('transaction.details.status')}</label>
              <p className="flex flex-items-center">
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
              </p>
            </div>
            <div className={style.detail}>
              <label>{t('transaction.details.date')}</label>
              <p>{shortDate}</p>
            </div>
            <div className={style.detail}>
              <label>{t('transaction.details.fiat')}</label>
              <p>
                <span className={`${style.fiat} ${typeClassName}`}>
                  <FiatConversion amount={amount} sign={sign} noAction />
                </span>
              </p>
            </div>
            <div className={style.detail}>
              <label>{t('transaction.details.fiatAtTime')}</label>
              <p>
                <span className={`${style.fiat} ${typeClassName}`}>
                  { transactionInfo.amountAtTime ?
                    <FiatConversion amount={transactionInfo.amountAtTime} sign={sign} noAction />
                    :
                    <FiatConversion noAction />
                  }
                </span>
              </p>
            </div>
            <div className={style.detail}>
              <label>{t('transaction.details.amount')}</label>
              <p className={typeClassName}>
                <span className={style.amount}>
                  {sign}
                  <Amount amount={amount.amount} unit={amount.unit}/>
                </span>
                {' '}
                <span className={style.currencyUnit}>{transactionInfo.amount.unit}</span>
              </p>
            </div>
            <div className={style.detail}>
              <label>{t('transaction.fee')}</label>
              {
                transactionInfo.fee && transactionInfo.fee.amount ? (
                  <p title={feeRatePerKb.amount ? feeRatePerKb.amount + ' ' + feeRatePerKb.unit + '/Kb' : ''}>
                    <Amount amount={transactionInfo.fee.amount} unit={transactionInfo.fee.unit}/>
                    {' '}
                    <span className={style.currencyUnit}>{transactionInfo.fee.unit}</span>
                  </p>
                ) : (
                  <p>---</p>
                )
              }
            </div>
            <div className={[style.detail, style.addresses].join(' ')}>
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
                <div className={style.detail}>
                  <label>{t('transaction.gas')}</label>
                  <p>{transactionInfo.gas}</p>
                </div>
              ) : null
            }
            {
              transactionInfo.nonce !== null ? (
                <div className={style.detail}>
                  <label>Nonce</label>
                  <p>{transactionInfo.nonce}</p>
                </div>
              ) : null
            }
            {
              transactionInfo.weight ? (
                <div className={style.detail}>
                  <label>{t('transaction.weight')}</label>
                  <p>
                    {transactionInfo.weight}
                    {' '}
                    <span className={style.currencyUnit}>WU</span>
                  </p>
                </div>
              ) : null
            }
            {
              transactionInfo.vsize ? (
                <div className={style.detail}>
                  <label>{t('transaction.vsize')}</label>
                  <p>
                    {transactionInfo.vsize}
                    {' '}
                    <span className={style.currencyUnit}>b</span>
                  </p>
                </div>
              ) : null
            }
            {
              transactionInfo.size ? (
                <div className={style.detail}>
                  <label>{t('transaction.size')}</label>
                  <p>
                    {transactionInfo.size}
                    {' '}
                    <span className={style.currencyUnit}>b</span>
                  </p>
                </div>
              ) : null
            }
            <div className={[style.detail, style.addresses].join(' ')}>
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
            <div className={[style.detail, 'flex-center'].join(' ')}>
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
