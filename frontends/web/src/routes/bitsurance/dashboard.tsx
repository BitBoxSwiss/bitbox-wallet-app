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
import { AccountCode, IAccount, getBalance } from '../../api/account';
import { Button } from '../../components/forms';
import { alertUser } from '../../components/alert/Alert';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { GuideWrapper, GuidedContent, Header, Main } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { useCallback, useEffect, useState } from 'react';
import { TAccountDetails, TDetailStatus, bitsuranceLookup } from '../../api/bitsurance';
import { A } from '../../components/anchor/anchor';
import { route } from '../../utils/route';
import { Amount } from '../../components/amount/amount';
import { useMountedRef } from '../../hooks/mount';
import { Balances } from '../account/summary/accountssummary';
import { Skeleton } from '../../components/skeleton/skeleton';
import { HideAmountsButton } from '../../components/hideamountsbutton/hideamountsbutton';
import { ExternalLink, GreenDot, OrangeDot, RedDot, YellowDot } from '../../components/icon';
import style from './dashboard.module.css';

type TProps = {
    accounts: IAccount[];
}

type TAccountStatusIconProps = {
  status: TDetailStatus;
}

const AccountStatusIcon = ({ status }: TAccountStatusIconProps) => {
  switch (status) {
  case 'active':
    return <GreenDot width={14} height={20} />;
  case 'processing':
  case 'waitpayment':
    return <YellowDot width={14} height={20} />;
  case 'refused':
    return <RedDot width={14} height={20} />;
  case 'inactive':
    return <OrangeDot width={14} height={20} />;
  case 'canceled':
    return <RedDot width={14} height={20} />;
  }
};

export const BitsuranceDashboard = ({ accounts }: TProps) => {
  const { t } = useTranslation();
  const mounted = useMountedRef();
  const [insuredAccounts, setInsuredAccounts] = useState<TAccountDetails[]>([]);
  const [balances, setBalances] = useState<Balances>();
  const [activeAccountCodes, setActiveAccountCodes] = useState<AccountCode[]>([]);

  const detect = useCallback(async () => {
    const response = await bitsuranceLookup();
    if (!response.success) {
      alertUser(response.errorMessage);
      return;
    }

    setInsuredAccounts(response.bitsuranceAccounts);
  }, []);

  useEffect(() => {
    setActiveAccountCodes(accounts.filter(ac => ac.active).map(ac => ac.code));
    detect();
    return () => setInsuredAccounts([]);
  }, [detect, accounts]);

  useEffect(() => {
    insuredAccounts.forEach(account => {
      getBalance(account.code).then(balance => {
        if (!mounted.current) {
          return;
        }
        setBalances((prevBalances) => ({
          ...prevBalances,
          [account.code]: balance
        }));

      });
    });
  }, [insuredAccounts, mounted]);
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
                  onClick={() => route('bitsurance/account')}
                  title={t('account.exportTransactions')}>
                  <span>+</span>
                  {t('bitsurance.dashboard.button')}
                </Button>
              </div>

              <div className={style.accountsContainer}>
                {insuredAccounts.map(account => activeAccountCodes.includes(account.code) ? (
                  <div key={account.code} className={style.row}>
                    <div className="flex flex-items-center">
                      <p className={`${style.text} ${style.accountName}`}>
                        {accounts.filter(ac => ac.code === account.code).map(ac => ac.name)}
                      </p>
                      { balances ? (
                        <span className={`${style.text} ${style.subtle}`}>
                          <Amount
                            amount={balances[account.code]?.available.amount}
                            unit={balances[account.code]?.available.unit}
                            removeBtcTrailingZeroes
                          />
                          {` ${balances[account.code]?.available.unit}`}
                        </span>
                      ) : <Skeleton/>}
                    </div>

                    <div className={'m-top-half m-bottom-half'}>
                      <p className={`${style.text} ${style.subtle} m-bottom-quarter`}>{t('bitsurance.dashboard.coverage')}</p>
                      <p className={style.text}>{account.details.maxCoverageFormatted} {account.details.currency}</p>
                    </div>

                    <div className="flex flex-column-mobile">
                      <div className="flex">
                        <AccountStatusIcon status={account.status} />
                        <p className={`${style.text} m-left-quarter m-right-half`}>{t('bitsurance.dashboard.' + account.status)}</p>
                      </div>
                      <A
                        className={`${style.text} ${style.link} m-top-quarter-on-small`}
                        href={account.details.support}
                      >
                        <div className="flex">
                          <ExternalLink width={16} />
                          <span className="m-left-quarter">{t('bitsurance.dashboard.supportLink')}</span>
                        </div>
                      </A>
                    </div>

                  </div>
                ) : null)}
              </div>

            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <BitsuranceGuide />
    </GuideWrapper>
  );
};

// TODO
const BitsuranceGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="guide.settings.servers" entry={t('guide.settings.servers')} />
    </Guide>
  );
};
