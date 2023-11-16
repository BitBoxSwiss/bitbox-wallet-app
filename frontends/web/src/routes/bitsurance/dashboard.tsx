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
import style from './dashboard.module.css';
import { useCallback, useEffect, useState } from 'react';
import { TAccountDetails, TDetailStatus, bitsuranceLookup } from '../../api/bitsurance';
import { A } from '../../components/anchor/anchor';
import { route } from '../../utils/route';
import { Amount } from '../../components/amount/amount';
import { useMountedRef } from '../../hooks/mount';
import { Balances } from '../account/summary/accountssummary';
import { Skeleton } from '../../components/skeleton/skeleton';
import { HideAmountsButton } from '../../components/hideamountsbutton/hideamountsbutton';
import { GreenDot, OrangeDot, RedDot, YellowDot } from '../../components/icon';


type TProps = {
    accounts: IAccount[];
}

type TAccountStatusIconProps = {
  status: TDetailStatus;
}

const AccountStatusIcon = ({ status }: TAccountStatusIconProps) => {
  switch (status) {
  case 'active':
    return <GreenDot/>;
  case 'processing':
  case 'waitpayment':
    return <YellowDot/>;
  case 'refused':
    return <RedDot/>;
  case 'inactive':
    return <OrangeDot/>;
  case 'canceled':
    return <RedDot/>;
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
            <HideAmountsButton/>
          </Header>
          <View>
            <ViewContent>
              <div className={style.container}>
                <div className="flex flex-between">
                  <label className="labelXLarge">
                    {t('bitsurance.dashboard.title')}
                  </label>
                  <Button
                    primary
                    onClick={() => route('bitsurance/account')}
                    title={t('account.exportTransactions')}>
                    {'+ ' + t('bitsurance.dashboard.button')}
                  </Button>
                </div>
                <div>
                  {insuredAccounts.map(account => activeAccountCodes.includes(account.code) ? (
                    <div key={account.code} className={style.row}>
                      <p><strong>{accounts.filter(ac => ac.code === account.code && ac.active).map(ac => ac.name)}</strong></p>
                      { balances ? (
                        <>
                          <Amount
                            amount={balances[account.code]?.available.amount}
                            unit={balances[account.code]?.available.unit}
                            removeBtcTrailingZeroes/>
                          {' ' + balances[account.code]?.available.unit}
                        </>
                      ) : <Skeleton/>}
                      <p>{t('bitsurance.dashboard.coverage')}</p>
                      <p>{account.details.maxCoverageFormatted} {account.details.currency}</p>
                      <p><span><AccountStatusIcon status={account.status}/>{t('bitsurance.dashboard.' + account.status)}</span> <A href={account.details.support}>{t('bitsurance.dashboard.supportLink')}</A></p>
                    </div>
                  ) : null)}
                </div>

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
