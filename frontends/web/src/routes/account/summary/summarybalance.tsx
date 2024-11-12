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
import * as accountApi from '@/api/account';
import { getAccountsPerCoin } from '@/routes/account/utils';
import { Balances } from './accountssummary';
import { BalanceRow } from './balancerow';
import { SubTotalRow } from './subtotalrow';
import { Amount } from '@/components/amount/amount';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Badge } from '@/components/badge/badge';
import { USBSuccess } from '@/components/icon';
import style from './accountssummary.module.css';

const TotalBalance = ({ total, fiatUnit }: accountApi.TAccountTotalBalance) => {
  return (
    <>
      <strong>
        <Amount amount={total} unit={fiatUnit} />
      </strong>{' '}
      <span className={style.coinUnit}>{fiatUnit}</span>
    </>
  );
};

type TProps = {
  accounts: accountApi.IAccount[];
  accountsKeystore: accountApi.TKeystore;
  totalBalancePerCoin?: accountApi.TAccountsBalanceByCoin;
  totalBalance?: accountApi.TAccountTotalBalance;
  balances?: Balances;
  keystoreDisambiguatorName?: string;
  lightningBalance?: accountApi.IBalance;
};

type TLightningProps = {
  lightningBalance?: accountApi.IBalance;
  lightningAccountKeystoreName: string;
  keystoreDisambiguatorName?: string;
}

export const SummaryBalance = ({
  accounts,
  accountsKeystore,
  totalBalancePerCoin,
  totalBalance,
  balances,
  keystoreDisambiguatorName,
  lightningBalance
}: TProps) => {
  const { t } = useTranslation();
  const accountsPerCoin = getAccountsPerCoin(accounts);
  const coins = Object.keys(accountsPerCoin) as accountApi.CoinCode[];

  return (
    <div>
      <div className={style.accountName}>
        <p>{accountsKeystore.name} {keystoreDisambiguatorName && `(${keystoreDisambiguatorName})`}</p>
        {accountsKeystore.connected ? (
          <Badge
            icon={props => <USBSuccess {...props} />}
            type="success"
          >
            {t('device.keystoreConnected')}
          </Badge>
        ) :
          null
        }
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
            {lightningBalance && (
              <BalanceRow key="lightning" code="lightning" name="Lightning" coinCode="lightning" balance={lightningBalance} />
            )}
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
                    const account = accountsForCoin[0];
                    balanceRows.push(
                      <SubTotalRow
                        key={account.coinCode}
                        coinCode={account.coinCode}
                        coinName={account.coinName}
                        balance={totalBalancePerCoin && totalBalancePerCoin[coinCode]}
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
                {totalBalance ? <TotalBalance total={totalBalance.total} fiatUnit={totalBalance.fiatUnit} /> : <Skeleton />}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};


export const LightningBalance = ({
  lightningBalance,
  lightningAccountKeystoreName,
  keystoreDisambiguatorName
}: TLightningProps) => {
  const { t } = useTranslation();
  return (
    <div>
      <div className={style.accountName}>
        <p>
          {lightningAccountKeystoreName} {keystoreDisambiguatorName && `(${keystoreDisambiguatorName})`}
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
            {lightningBalance && (
              <BalanceRow key="lightning" code="lightning" name="Lightning" coinCode="lightning" balance={lightningBalance} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
