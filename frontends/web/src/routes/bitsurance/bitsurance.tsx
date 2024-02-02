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
import { Column, ColumnButtons, Grid, GuidedContent, GuideWrapper, Header, Main } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { useDarkmode } from '../../hooks/darkmode';
import { route } from '../../utils/route';
import { BitsuranceGuide } from './guide';
import style from './bitsurance.module.css';
import { i18n } from '../../i18n/i18n';

type TProps = {
    accounts: IAccount[];
}

export const Bitsurance = ({ accounts }: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const [insuredAccounts, setInsuredAccounts] = useState<IAccount[]>([]);
  const [redirecting, setRedirecting] = useState(true);
  const [scanDone, setScanDone] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  const amount = '100.000€';

  useEffect(() => {
    if (accounts.some(({ bitsuranceStatus }) => bitsuranceStatus)) {
      route('bitsurance/dashboard');
    } else {
      setRedirecting(false);
    }

    return () => setInsuredAccounts([]);
  }, [accounts]);

  const detect = async (redirectToDashboard: boolean) => {
    setScanLoading(true);
    setScanDone(false);
    setInsuredAccounts([]);
    const response = await bitsuranceLookup();
    if (!response.success) {
      alertUser(response.errorMessage);
      return;
    }
    const insuredAccountsCodes = response.bitsuranceAccounts.map(account => account.status ? account.code : null);
    const insured = accounts.filter(({ code }) => insuredAccountsCodes.includes(code));
    setInsuredAccounts(insured);
    setScanDone(true);
    setScanLoading(false);
    if (insured.length && redirectToDashboard) {
      route('bitsurance/dashboard');
    }
  };

  const getBitsurancePageLink = (): string => {
    switch (i18n.resolvedLanguage) {
    case 'de':
      return 'https://www.bitsurance.eu/de/bitbox/';
    default:
      return 'https://www.bitsurance.eu/en/bitbox/';
    }
  };

  const maybeProceed = async () => {
    // we force a detection to verify if there is any new insured account
    // before proceeding to the next step.
    await detect(false);
    route('bitsurance/account');
  };

  if (redirecting) {
    return null;
  }

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('sidebar.insurance')}</h2>} />
          <View fullscreen={false}>
            <ViewContent>
              <p className={style.noVspace}>{t('bitsurance.intro.text1', { amount })}</p>
              <div className={style.gridContainer}>
                <Grid col="2" textAlign="left">
                  <Column asCard>
                    <h3 className={style.title}>
                      {t('bitsurance.insure.title')}
                    </h3>
                    <p className={style.cardBody}>{t('bitsurance.insure.text')}</p>
                    <ul className={style.clean}>
                      <li><Checked/><span>{t('bitsurance.insure.listItem1')}</span></li>
                      <li><Checked/><span>{t('bitsurance.insure.listItem2')}</span></li>
                      <li><Checked/><span>{t('bitsurance.insure.listItem3')}</span></li>
                    </ul>
                    <p className={style.cardBody2}>
                      {t('bitsurance.insure.text2')} {' '}
                      <A href={getBitsurancePageLink()}>{t('bitsurance.intro.link')}</A>.
                    </p>
                    <p className={style.cardBody2}>
                      {t('bitsurance.insure.text3')}
                    </p>
                    <ColumnButtons className={style.ctaButton}>
                      <Button onClick={maybeProceed} primary>
                        {t('bitsurance.insure.button')}
                      </Button>
                    </ColumnButtons>
                  </Column>
                  <Column asCard>
                    <h3 className={style.title}>
                      {t('bitsurance.detect.title')}
                    </h3>
                    <p className={style.cardBody}>{t('bitsurance.detect.text')}</p>
                    {!insuredAccounts.length && scanDone && (
                      <p className={`${style.cardBody2} ${style.errorMessage}`}>{t('bitsurance.detect.notInsured')}</p>
                    )}
                    <ColumnButtons className={style.ctaButton}>
                      <Button
                        onClick={() => detect(true)}
                        disabled={scanLoading}
                        secondary
                      >
                        {isDarkMode ? <SyncLight/> : <Sync/>}
                        {t('bitsurance.detect.button')}
                      </Button>
                    </ColumnButtons>

                  </Column>
                </Grid>
              </div>
            </ViewContent>
          </View>
        </GuidedContent>
        <BitsuranceGuide/>
      </GuideWrapper>
    </Main>
  );
};
