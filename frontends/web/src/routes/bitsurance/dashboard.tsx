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

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountCode, TAccount, getBalance } from '@/api/account';
import { TAccountDetails, TDetailStatus, bitsuranceLookup } from '@/api/bitsurance';
import { useMountedRef } from '@/hooks/mount';
import { TAccountsByKeystore, getAccountsByKeystore, isAmbiguousName } from '@/routes/account/utils';
import { Button } from '@/components/forms';
import { alertUser } from '@/components/alert/Alert';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { A } from '@/components/anchor/anchor';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Balances } from '@/routes/account/summary/accountssummary';
import { Skeleton } from '@/components/skeleton/skeleton';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { ExternalLink, GreenDot, OrangeDot, RedDot, YellowDot } from '@/components/icon';
import { HorizontallyCenteredSpinner } from '@/components/spinner/SpinnerAnimation';
import { BitsuranceGuide } from './guide';
import style from './dashboard.module.css';

type TProps = {
  accounts: TAccount[];
};

type TAccountStatusIconProps = {
  status: TDetailStatus;
};

type TInsurancesByCode = {
  [accountCode: AccountCode]: TAccountDetails;
};

const AccountStatusIcon = ({ status }: TAccountStatusIconProps) => {
  switch (status) {
  case 'active':
    return <GreenDot width={14}/>;
  case 'processing':
  case 'waitpayment':
    return <YellowDot width={14}/>;
  case 'refused':
    return <RedDot width={14}/>;
  case 'inactive':
    return <OrangeDot width={14}/>;
  case 'canceled':
    return <RedDot width={14}/>;
  }
};

export const BitsuranceDashboard = ({ accounts }: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const mounted = useMountedRef();
  const [balances, setBalances] = useState<Balances>();
  const [insurances, setInsurances] = useState<TInsurancesByCode>();
  const [accountsByKeystore, setAccountsByKeystore] = useState<TAccountsByKeystore[]>();

  // anyAccountInsured returns true if any of the accounts belonging
  // to a certain keystore is contained in the insurances map.
  const anyAccountInsured = (keystore: TAccountsByKeystore) => {
    return keystore.accounts?.some(account => !!account.bitsuranceStatus);
  };

  const fetchInsurances = useCallback(async () => {
    const response = await bitsuranceLookup();
    if (!response.success) {
      alertUser(response.errorMessage);
      return;
    }
    let accountsInsurance = {} as TInsurancesByCode;
    response.bitsuranceAccounts.forEach(insurance => {
      accountsInsurance[insurance.code] = insurance;
    });
    setInsurances(accountsInsurance);
  }, []);

  useEffect(() => {
    setAccountsByKeystore(getAccountsByKeystore(accounts));
    fetchInsurances();
  }, [fetchInsurances, accounts]);

  useEffect(() => {
    accountsByKeystore?.forEach(keystore => {
      keystore.accounts
        .filter(account => !!account.bitsuranceStatus)
        .forEach(account => {
          getBalance(account.code).then(balance => {
            if (!mounted.current) {
              return;
            }
            if (!balance.success) {
              return;
            }
            setBalances((prevBalances) => ({
              ...prevBalances,
              [account.code]: balance.balance
            }));
          });
        });
    });
    return () => {
      setBalances(undefined);
    };
  }, [accountsByKeystore, mounted]);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('sidebar.insurance')}</h2>} >
            <HideAmountsButton />
          </Header>
          <View>
            <ViewContent>

              <div className={style.headerContainer}>
                <p className={style.title}>
                  {t('bitsurance.dashboard.title')}
                </p>
                <Button
                  className={style.button}
                  primary
                  onClick={() => navigate('/bitsurance/account')}
                  title={t('account.exportTransactions')}>
                  <span>+</span>
                  {t('bitsurance.dashboard.button')}
                </Button>
              </div>

              <div className={style.accountsContainer}>
                {accountsByKeystore?.length && insurances ? accountsByKeystore.map(({ accounts, keystore }) => (
                  anyAccountInsured({ accounts, keystore }) && (
                    <div key={keystore.rootFingerprint}>
                      <p className={style.keystore}>{keystore.name}
                        { isAmbiguousName(keystore.name, accountsByKeystore) ? (
                        // Disambiguate accounts group by adding the fingerprint.
                        // The most common case where this would happen is when adding accounts from the
                        // same seed using different passphrases.
                          <span className={style.subtle}> ({keystore.rootFingerprint})</span>
                        ) : null }
                      </p>
                      <div>
                        {accounts?.length ? accounts.map(account => {
                          const balance = balances && balances[account.code];
                          const insurance = insurances[account.code];
                          return insurance ? (
                            <div key={account.code} className={style.row}>
                              <div className="flex flex-wrap flex-items-center">
                                <p className={`${style.text || ''} ${style.accountName || ''}`}>
                                  {accounts.filter(ac => ac.code === account.code).map(ac => ac.name)}
                                </p>
                                <span className={`${style.text || ''} ${style.subtle || ''}`}>
                                  { balance ? (
                                    <AmountWithUnit amount={balance.available} />
                                  ) : <Skeleton/>}
                                </span>
                              </div>

                              <div className={'m-top-half m-bottom-half'}>
                                <p className={`${style.text || ''} ${style.subtle || ''} m-bottom-quarter`}>
                                  {t('bitsurance.dashboard.coverage')}
                                </p>
                                <p className={style.text}>
                                  {insurance.details.maxCoverageFormatted}
                                  {' '}
                                  {insurance.details.currency}
                                </p>
                              </div>

                              <div className="flex flex-column-mobile">
                                <div className="flex">
                                  <AccountStatusIcon status={insurance.status} />
                                  <p className={`${style.text || ''} m-left-quarter m-right-half`}>
                                    {t('bitsurance.dashboard.' + insurance.status)}
                                  </p>
                                </div>
                                <A
                                  className={`${style.text || ''} ${style.link || ''} m-top-quarter-on-small`}
                                  href={insurance.details.support}
                                >
                                  <div className={style.externalLink}>
                                    <ExternalLink />
                                    <span className="m-left-quarter">
                                      {t('bitsurance.dashboard.supportLink')}
                                    </span>
                                  </div>
                                </A>
                              </div>

                            </div>
                          ) : null;
                        }) : <HorizontallyCenteredSpinner />}
                      </div>
                    </div>
                  )
                )) : <HorizontallyCenteredSpinner />}
              </div>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <BitsuranceGuide />
    </GuideWrapper>
  );
};
