// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useOnlyVisitableOnMobile } from '@/hooks/onlyvisitableonmobile';
import * as accountApi from '@/api/account';
import { getBalance } from '@/api/account';
import { Logo } from '@/components/icon/logo';
import { View, ViewContent } from '@/components/view/view';
import { getAccountsByKeystore } from '@/routes/account/utils';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { Main, Header } from '@/components/layout';
import { ChevronRightDark } from '@/components/icon/icon';
import { AllAccountsGuide } from '@/routes/accounts/all-accounts-guide';
import { useMountedRef } from '@/hooks/mount';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { ConnectedKeystore } from '@/components/keystore/connected-keystore';
import styles from './all-accounts.module.css';

type AllAccountsProps = {
  accounts?: accountApi.TAccount[];
};

type TAccountItemProp = {
  account: accountApi.TAccount;
};

const AccountItem = ({ account }: TAccountItemProp) => {
  const [balance, setBalance] = useState<accountApi.TAmountWithConversions>();
  const mounted = useMountedRef();

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balance = await getBalance(account.code);
        if (!mounted.current) {
          return;
        }
        if (!balance.success) {
          setBalance(undefined);
          return;
        }
        setBalance(balance.balance.available);
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
        <AmountWithUnit amount={balance} unitClassName={styles.unit} />
      </div>
      <ChevronRightDark />
    </Link>
  );
};

/**
 * This component will only be shown on mobile.
 **/
export const AllAccounts = ({ accounts = [] }: AllAccountsProps) => {
  const { t } = useTranslation();
  const accountsByKeystore = getAccountsByKeystore(accounts);
  useOnlyVisitableOnMobile('/settings/manage-accounts');

  return (
    <Main>
      <Header title={<h2>{t('account.accounts')}</h2>}>
        <HideAmountsButton />
      </Header>
      <View width="768px" fullscreen={false}>
        <ViewContent>
          <div className={styles.container}>
            {accountsByKeystore.map(keystore => (
              <div key={`keystore-${keystore.keystore.rootFingerprint}`}>
                <ConnectedKeystore
                  accountsByKeystore={accountsByKeystore}
                  keystore={keystore.keystore}
                  className={styles.keystoreName}
                />
                <div className={styles.accountsList}>
                  {keystore.accounts.map(account => (
                    <AccountItem key={`account-${account.code}`} account={account} />
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
