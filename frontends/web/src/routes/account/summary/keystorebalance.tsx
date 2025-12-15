// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import type { TKeystore } from '@/api/account';
import { getAccountsPerCoin, TAccountsByKeystore } from '@/routes/account/utils';
import { Balances } from './accountssummary';
import { BalanceRow } from './balancerow';
import { SubTotalRow } from './subtotalrow';
import { Amount } from '@/components/amount/amount';
import { Skeleton } from '@/components/skeleton/skeleton';
import { ConnectedKeystore } from '@/components/keystore/connected-keystore';
import style from './accountssummary.module.css';

type TProps = {
  accounts: accountApi.TAccount[];
  accountsByKeystore: TAccountsByKeystore[];
  keystore: TKeystore;
  keystoreBalance?: accountApi.TKeystoreBalance;
  balances?: Balances;
};

export const KeystoreBalance = ({
  accountsByKeystore,
  accounts,
  keystore,
  keystoreBalance,
  balances,
}: TProps) => {
  const { t } = useTranslation();

  const accountsPerCoin = getAccountsPerCoin(accounts);
  const coins = Object.keys(accountsPerCoin) as accountApi.CoinCode[];

  return (
    <div>
      <div className={style.accountName}>
        <p>
          <ConnectedKeystore
            accountsByKeystore={accountsByKeystore}
            keystore={keystore} />
        </p>
      </div>
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
                const balanceRows = accountsPerCoin[coinCode]?.map(account => (
                  <BalanceRow
                    key={account.code}
                    code={account.code}
                    name={account.name}
                    coinCode={account.coinCode}
                    balance={balances && balances[account.code]}
                  />
                ));
                if (balanceRows && balanceRows?.length > 1) {
                  const accountsForCoin = accountsPerCoin[coinCode];
                  if (accountsForCoin && accountsForCoin.length >= 1) {
                    const account = accountsForCoin[0] as accountApi.TAccount;
                    balanceRows.push(
                      <SubTotalRow
                        key={account.coinCode}
                        coinCode={account.coinCode}
                        coinName={account.coinName}
                        balance={keystoreBalance?.coinsBalance && keystoreBalance.coinsBalance[coinCode]}
                      />);
                  }
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
                {keystoreBalance ? (
                  <strong className={style.summaryTableBalance}>
                    <Amount
                      amount={keystoreBalance.total}
                      unit={keystoreBalance.fiatUnit}
                    />
                    <span className={style.coinUnit}>
                      {keystoreBalance.fiatUnit}
                    </span>
                  </strong>
                ) : (<Skeleton />)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
