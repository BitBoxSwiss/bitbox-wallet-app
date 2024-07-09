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
import { FiatConversion } from '@/components/rates/rates';
import { Amount } from '@/components/amount/amount';
import { Arrow } from './components/arrow';
import { TxDate } from './components/date';
import { TxStatus } from './components/status';
import { ShowDetailsButton } from './components/show-details-button';
import { TxAddress } from './components/address-or-txid';
import { TxDetailsDialog } from './components/details';
import parentStyle from './transactions.module.css';
import style from './transaction.module.css';

type Props = {
  accountCode: accountApi.AccountCode;
  explorerURL: string;
} & accountApi.ITransaction;

export const Transaction = ({
  accountCode,
  internalID,
  explorerURL,
  type,
  amount,
  numConfirmations,
  numConfirmationsComplete,
  time,
  addresses,
  status,
  note = '',
}: Props) => {
  const { t } = useTranslation();
  const [transactionDialog, setTransactionDialog] = useState<boolean>(false);

  const sign = ((type === 'send') && '−') || ((type === 'receive') && '+') || '';
  const typeClassName = (status === 'failed' && style.failed) || (type === 'send' && style.send) || (type === 'receive' && style.receive) || '';

  return (
    <div className={style.container}>
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
            onClick={() => setTransactionDialog(true)}
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
            onClick={() => setTransactionDialog(true)}
            expand={!transactionDialog}
          />
        </div>
      </div>
      <TxDetailsDialog
        open={transactionDialog}
        onClose={() => setTransactionDialog(false)}
        accountCode={accountCode}
        internalID={internalID}
        note={note}
        status={status}
        type={type}
        numConfirmations={numConfirmations}
        numConfirmationsComplete={numConfirmationsComplete}
        time={time}
        amount={amount}
        sign={sign}
        typeClassName={typeClassName}
        explorerURL={explorerURL}
      />
    </div>
  );
};
