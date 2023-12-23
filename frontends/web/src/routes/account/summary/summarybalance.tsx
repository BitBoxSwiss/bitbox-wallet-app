/**
 * Copyright 2023 Shift Crypto AG
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
import * as accountApi from '../../../api/account';
import { Balances } from './accountssummary';
import { BalanceRow } from './balancerow';
import { SubTotalRow } from './subtotalrow';
import { Amount } from '../../../components/amount/amount';
import { Skeleton } from '../../../components/skeleton/skeleton';
import style from './accountssummary.module.css';

type TProps = {
  accounts: accountApi.IAccount[],
  summaryData?: accountApi.ISummary,
  totalBalancePerCoin?: accountApi.ITotalBalance,
  balances?: Balances,
}

type TAccountCoinMap = {
  [code in accountApi.CoinCode]: accountApi.IAccount[];
};

export function SummaryBalance ({
  accounts,
  summaryData,
  totalBalancePerCoin,
  balances,
}: TProps) {
  const { t } = useTranslation();

  const getAccountsPerCoin = () => {
    return accounts.reduce((accountPerCoin, account) => {
      accountPerCoin[account.coinCode]
        ? accountPerCoin[account.coinCode].push(account)
        : accountPerCoin[account.coinCode] = [account];
      return accountPerCoin;
    }, {} as TAccountCoinMap);
  };

  const accountsPerCoin = getAccountsPerCoin();
  const coins = Object.keys(accountsPerCoin) as accountApi.CoinCode[];

  return (
    <div className={style.balanceTable}>
      <table className={style.table}>
        <colgroup>
          <col width="33%" />
          <col width="33%" />
          <col width="*" />
        </colgroup>
        <thead>
          <tr>
            <th>{t('accountSummary.name')}</th>
            <th>{t('accountSummary.balance')}</th>
            <th>{t('accountSummary.fiatBalance')}</th>
          </tr>
        </thead>
        <tbody>
          { accounts.length > 0 ? (
            coins.map(coinCode => {
              const balanceRows = accountsPerCoin[coinCode].map(account =>
                <BalanceRow
                  key={account.code}
                  code={account.code}
                  name={account.name}
                  coinCode={account.coinCode}
                  balance={balances && balances[account.code]}
                />
              );
              if (balanceRows?.length > 1) {
                const account = accountsPerCoin[coinCode][0];
                balanceRows.push(
                  <SubTotalRow
                    key={account.coinCode}
                    coinCode={account.coinCode}
                    coinName={account.coinName}
                    balance={totalBalancePerCoin && totalBalancePerCoin[coinCode]}
                  />);
              }
              return balanceRows;
            })
          ) : (
            <tr>
              <td colSpan={3} className={style.noAccount}>
                {t('accountSummary.noAccount')}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th>
              <strong>{t('accountSummary.total')}</strong>
            </th>
            <td colSpan={2}>
              {(summaryData && summaryData.formattedChartTotal !== null) ? (
                <>
                  <strong>
                    <Amount amount={summaryData.formattedChartTotal} unit={summaryData.chartFiat}/>
                  </strong>
                  {' '}
                  <span className={style.coinUnit}>
                    {summaryData.chartFiat}
                  </span>
                </>
              ) : (<Skeleton />) }
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
