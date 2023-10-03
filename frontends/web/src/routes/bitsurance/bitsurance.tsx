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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IAccount } from '../../api/account';
import { bitsuranceLookup } from '../../api/bitsurance';
import { alertUser } from '../../components/alert/Alert';
import { A } from '../../components/anchor/anchor';
import { Button } from '../../components/forms';
import { Checked, Sync, SyncLight } from '../../components/icon';
import Logo from '../../components/icon/logo';
import { Column, Grid, GuidedContent, GuideWrapper, Header, Main } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { useDarkmode } from '../../hooks/darkmode';
import { route } from '../../utils/route';
import { BitsuranceGuide } from './guide';
import style from './bitsurance.module.css';

type TProps = {
    accounts: IAccount[];
}

export const Bitsurance = ({ accounts }: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const [insuredAccounts, setInsuredAccounts] = useState<IAccount[]>([]);
  const [scanDone, setScanDone] = useState(false);

  const amount = '100.000€';

  useEffect(() => {
    setInsuredAccounts(accounts.filter(({ bitsuranceId }) => bitsuranceId));
    return () => setInsuredAccounts([]);
  }, [accounts]);

  const detect = async () => {
    setScanDone(false);
    setInsuredAccounts([]);
    const response = await bitsuranceLookup();
    if (!response.success) {
      alertUser(response.errorMessage);
      return;
    }
    setInsuredAccounts(accounts.filter(({ code }) => response.accountCodes.includes(code)));
    setScanDone(true);
  };

  const maybeProceed = async () => {
    // we force a detection to verify if there is any new insured account
    // before proceeding to the next step.
    await detect();
    route('bitsurance/account');
  };
  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('sidebar.insurance')}</h2>} />
          <View fullscreen={false}>
            <ViewContent fullWidth>
              <p className={style.noVspace}>{t('bitsurance.intro.text1', { amount })}</p>
              <p className={style.noVspace}>{t('bitsurance.intro.text2')} <A href="https://www.bitsurance.eu/">{t('bitsurance.intro.link')}</A>.</p>
              <Grid col="2" textAlign="left">
                <Column asCard>
                  <h3 className="title">
                    {t('bitsurance.insure.title')}
                  </h3>
                  <p>{t('bitsurance.insure.text')}</p>
                  <ul className={style.clean}>
                    <li><Checked/><span>{t('bitsurance.insure.listItem1')}</span></li>
                    <li><Checked/><span>{t('bitsurance.insure.listItem2')}</span></li>
                  </ul>
                  <Button onClick={ maybeProceed } primary>
                    {t('bitsurance.insure.button')}
                  </Button>
                  <A href="https://www.bitsurance.eu/faq/">{t('bitsurance.insure.faq')}</A>
                </Column>
                <Column asCard>
                  <h3 className="title">
                    {t('bitsurance.detect.title')}
                  </h3>
                  <p>{t('bitsurance.detect.text')}</p>
                  {insuredAccounts.length > 0 ? (
                    //FIXME this will be removed and a new page listing the dashboard of the
                    // insured accounts will be introduced in a next commit.
                    <div>
                      <p>{t('bitsurance.detect.insured')}</p>
                      <ul className={style.clean}>
                        {insuredAccounts.map(account => <li key={account.code}>
                          <Logo coinCode="btc" active={true} alt="btc" />
                          {account.name}</li>)}
                      </ul>
                    </div>
                  ) : scanDone && (
                    <p>{t('bitsurance.detect.notInsured')}</p>
                  )}
                  <Button
                    onClick={detect }
                    primary>
                    {isDarkMode ? <SyncLight/> : <Sync/>}
                    {t('bitsurance.detect.button')}
                  </Button>
                </Column>
              </Grid>
            </ViewContent>
          </View>
        </GuidedContent>
        <BitsuranceGuide/>
      </GuideWrapper>
    </Main>
  );
};
