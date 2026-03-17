// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as accountApi from '@/api/account';
import type { TKeystore } from '@/api/account';
import { getAccountsPerCoin, TAccountsByKeystore } from '@/routes/account/utils';
import { Balances } from './accountssummary';
import { ConnectedKeystore } from '@/components/keystore/connected-keystore';
import { AssetBalance } from './asset-balance';
import { AssetBalanceTotal } from './asset-balance-total';
import { AssetBalanceWithLine } from './asset-balance-with-line';
import { BalanceSection } from './balance-section';
import style from './accountssummary.module.css';

type TProps = {
  accounts: accountApi.TAccount[];
  accountsByKeystore: TAccountsByKeystore[];
  keystore: TKeystore;
  keystoreBalance?: accountApi.TKeystoreBalance;
  balances?: Balances;
};


export const KeystoreBalance = ({ accounts, accountsByKeystore, keystore, keystoreBalance, balances }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const accountsPerCoin = getAccountsPerCoin(accounts);
  const coins = Object.keys(accountsPerCoin) as accountApi.CoinCode[];

  return (
    <BalanceSection
      name={
        <ConnectedKeystore
          className={style.keystoreName}
          accountsByKeystore={accountsByKeystore}
          keystore={keystore}
        />
      }
      totalAmount={keystoreBalance?.total}
      fiatUnit={keystoreBalance?.fiatUnit}
    >
      { accounts.length > 0 ? (
        coins.map(coinCode => {
          const coinAccounts = accountsPerCoin[coinCode] ?? [];
          const coinName = coinAccounts[0]?.coinName ?? coinCode;
          const showTotal = coinAccounts.length > 1;
          const totalAmount = keystoreBalance?.coinsBalance?.[coinCode];

          return (
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!showTotal) {
                  navigate(`/account/${coinAccounts[0]?.code ?? ''}`);
                }
              }}
              key={coinCode}
              className={`
              ${style.coinGroupCard || ''} 
              ${!showTotal ? style.clickable || '' : ''}
              `}
            >
              {showTotal && (
                <AssetBalanceTotal
                  amount={totalAmount}
                  coinCode={coinCode}
                  coinName={coinName}
                />
              )}

              {coinAccounts.map((account, ix) => {
                const balance = balances?.[account.code];

                if (showTotal) {
                  return (
                    <AssetBalanceWithLine
                      key={account.code}
                      account={account}
                      coinCode={account.coinCode}
                      isFirst={ix === 0}
                      balances={balances}
                    />
                  );
                }

                return (
                  <AssetBalance
                    key={account.code}
                    amount={balance?.available}
                    coinCode={account.coinCode}
                    coinName={account.name}
                    dataTestId="account-name"
                  />
                );
              })}
            </div>
          );
        })
      ) : (
        <div className={style.coinGroupCard}>
          <p className={style.noAccountText}>
            {t('accountSummary.noAccount')}
          </p>
        </div>
      )}
    </BalanceSection>
  );
};