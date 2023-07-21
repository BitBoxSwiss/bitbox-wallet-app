/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import { TTransactions } from '../../api/account';
import { A } from '../../components/anchor/anchor';
import { runningInAndroid } from '../../utils/env';
import { Transaction } from './transaction';
import style from './transactions.module.css';

type TProps = {
    accountCode: string;
    explorerURL: string;
    transactions?: TTransactions;
    handleExport: () => void;
};

export const Transactions = ({
  accountCode,
  explorerURL,
  transactions,
  handleExport,
}: TProps) => {
  const { t } = useTranslation();

  // We don't support CSV export on Android yet, as it's a tricky to deal with the Downloads
  // folder and permissions.
  const csvExportDisabled = runningInAndroid();

  return (
    <div className={style.container}>
      <div className="flex flex-row flex-between flex-items-center">
        <label className="labelXLarge">
          {t('accountSummary.transactionHistory')}
        </label>
        { !csvExportDisabled && (
          <A key="export" href="#" onClick={handleExport} className="labelXLarge labelLink" title={t('account.exportTransactions')}>
            {t('account.export')}
          </A>
        ) }
      </div>
      <div className={[style.columns, style.headers, style.showOnMedium].join(' ')}>
        <div className={style.type}>{t('transaction.details.type')}</div>
        <div className={style.date}>{t('transaction.details.date')}</div>
        <div className={style.activity}>{t('transaction.details.activity')}</div>
        <div className={style.status}>{t('transaction.details.status')}</div>
        <div className={style.fiat}>{t('transaction.details.fiatAmount')}</div>
        <div className={style.currency}>{t('transaction.details.amount')}</div>
        <div className={style.action}>&nbsp;</div>
      </div>
      { (transactions && transactions.success && transactions.list.length > 0)
        ? transactions.list.map((props, index) => (
          <Transaction
            accountCode={accountCode}
            key={props.internalID}
            explorerURL={explorerURL}
            index={index}
            {...props} />
        )) : (
          <div className={`flex flex-row flex-center ${style.empty}`}>
            { transactions && !transactions.success ? (
              <p>{t('transactions.errorLoadTransactions')}</p>
            ) : (
              <p>{t('transactions.placeholder')}</p>
            ) }
          </div>
        ) }
    </div>
  );
};
