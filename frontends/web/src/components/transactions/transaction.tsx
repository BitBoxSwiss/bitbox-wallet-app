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
import { FiatConversion } from '@/components/rates/rates';
import { Amount } from '@/components/amount/amount';
import { Note } from './note';
import { TxDetail } from './components/detail';
import { Arrow } from './components/arrow';
import { TxDate, TxDateDetail } from './components/date';
import { TxStatus, TxStatusDetail } from './components/status';
import { ShowDetailsButton } from './components/show-details-button';
import { TxAddress, TxDetailCopyableValues } from './components/address-or-txid';
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
  const { t } = useTranslation();
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

  const sign = ((type === 'send') && '−') || ((type === 'receive') && '+') || '';
  const typeClassName = (status === 'failed' && style.failed) || (type === 'send' && style.send) || (type === 'receive' && style.receive) || '';

  return (
    <div className={`${style.container} ${index === 0 ? style.first : ''}`}>
      <div className={`${parentStyle.columns} ${style.row}`}>
        <div className={parentStyle.columnGroup}>
          <div className={parentStyle.type}>
            <Arrow
              status={status}
              type={type}
            />
          </div>
          <TxDate time={time} />
          {note ? (
            <div className={parentStyle.activity}>
              <span className={style.address}>
                {note}
              </span>
            </div>
          ) : (
            <TxAddress
              label={t(type === 'receive' ? 'transaction.tx.received' : 'transaction.tx.sent')}
              addresses={addresses}
            />
          )}
          <ShowDetailsButton
            onClick={showDetails}
            expand={!transactionDialog}
            hideOnMedium
          />
        </div>
        <div className={parentStyle.columnGroup}>
          <TxStatus
            status={status}
            numConfirmations={numConfirmations}
            numConfirmationsComplete={numConfirmationsComplete}
          />
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
          <ShowDetailsButton
            onClick={showDetails}
            expand={!transactionDialog}
          />
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
            <TxDetailCopyableValues
              label={t('transaction.explorer')}
              values={[transactionInfo.txID]}
            />
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
