/**
 * Copyright 2025 Shift Crypto AG
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
import { Link } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import { useOnlyVisitableOnMobile } from '@/hooks/onlyvisitableonmobile';
import * as accountApi from '@/api/account';
import { getBalance } from '@/api/account';
import { Logo } from '@/components/icon/logo';
import { View, ViewContent } from '@/components/view/view';
import { getAccountsByKeystore, isAmbiguousName } from '@/routes/account/utils';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { Main, Header } from '@/components/layout';
import { Badge } from '@/components/badge/badge';
import { ChevronRightDark, USBSuccess } from '@/components/icon/icon';
import { AppContext } from '@/contexts/AppContext';
import { AllAccountsGuide } from '@/routes/accounts/all-accounts-guide';
import { useMountedRef } from '@/hooks/mount';
import styles from './all-accounts.module.css';

type AllAccountsProps = {
  accounts?: accountApi.IAccount[];
};

const AccountItem = ({ account, hideAmounts }: { account: accountApi.IAccount, hideAmounts: boolean }) => {
  const [balance, setBalance] = useState<string>('');
  const mounted = useMountedRef();

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balance = await getBalance(account.code);
        if (!mounted.current) {
          return;
        }
        if (!balance.success) {
          return;
        }
        const balanceData = balance.balance;
        if (balanceData.hasAvailable) {
          setBalance(balanceData.available.amount);
        } else {
          setBalance('0');
        }
      } catch (error) {
        console.error('Failed to fetch balance for account', account.code, error);
      }
    };

    fetchBalance();
  }, [account.code, mounted]);

  return (
    <Link to={`/account/${account.code}`} className={styles.accountItem}>
      <div className={styles.accountIcon}>
        <Logo coinCode={account.coinCode} alt={account.name} />
      </div>
      <p className={styles.accountName}>
        {account.name}
      </p>

      <div className={styles.accountBalanceContainer}>
        <div className={styles.accountBalance}>
          {balance ? (hideAmounts ? '***' : balance) : '...'}
        </div>
        <div className={styles.coinUnit}>
          {balance ? account.coinUnit : ''}
        </div>
      </div>
      <div className={styles.chevron}>
        <ChevronRightDark />
      </div>
    </Link>
  );
};


/**
 * This component will only be shown on mobile.
 **/
export const AllAccounts = ({ accounts = [] }: AllAccountsProps) => {
  const { t } = useTranslation();
  const { hideAmounts } = useContext(AppContext);
  const accountsByKeystore = getAccountsByKeystore(accounts);
  useOnlyVisitableOnMobile('/settings/manage-accounts');

  return (

    <Main>
      <Header title={<h2>{t('settings.accounts')}</h2>}>
        <HideAmountsButton />
      </Header>
      <View width="700px" fullscreen={false}>
        <ViewContent>
          <div className={styles.container}>
            {accountsByKeystore.map(keystore => (
              <div key={`keystore-${keystore.keystore.rootFingerprint}`}>
                <div className={styles.keystoreHeader}>
                  {keystore.keystore.name}
                  { isAmbiguousName(keystore.keystore.name, accountsByKeystore) ? (
                    // Disambiguate accounts group by adding the fingerprint.
                    // The most common case where this would happen is when adding accounts from the
                    // same seed using different passphrases.
                    <> ({keystore.keystore.rootFingerprint})</>
                  ) : null }
                  {keystore.keystore.connected && (
                    <Badge
                      icon={props => <USBSuccess {...props} />}
                      type="success"
                      title={t('device.keystoreConnected')} />
                  )}

                </div>
                <div className={styles.accountsList}>
                  {keystore.accounts.map(account => (
                    <AccountItem hideAmounts={hideAmounts} key={`account-${account.code}`} account={account} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ViewContent>
      </View>
      <AllAccountsGuide />
    </Main >

  );
};
