// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TAccount } from '@/api/account';
import { bitsuranceLookup } from '@/api/bitsurance';
import { alertUser } from '@/components/alert/Alert';
import { A } from '@/components/anchor/anchor';
import { Button } from '@/components/forms';
import { Checked, Sync, SyncLight } from '@/components/icon';
import { Column, ColumnButtons, Grid, GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { useDarkmode } from '@/hooks/darkmode';
import { BitsuranceGuide } from './guide';
import { i18n } from '@/i18n/i18n';
import style from './bitsurance.module.css';

type TProps = {
  accounts: TAccount[];
};

export const Bitsurance = ({ accounts }: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const [insuredAccounts, setInsuredAccounts] = useState<TAccount[]>([]);
  const [redirecting, setRedirecting] = useState(true);
  const [scanDone, setScanDone] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  const amount = '100.000€';

  useEffect(() => {
    if (accounts.some(({ bitsuranceStatus }) => bitsuranceStatus)) {
      // replace current history item when redirecting so that the user can go back
      navigate('/bitsurance/dashboard', { replace: true });
    } else {
      setRedirecting(false);
    }

    return () => setInsuredAccounts([]);
  }, [accounts, navigate]);

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
      navigate('/bitsurance/dashboard');
    }
  };

  const getBitsurancePageLink = (): string => {
    switch (i18n.resolvedLanguage) {
    case 'de':
      return 'https://www.bitsurance.io/de/bitbox/';
    default:
      return 'https://www.bitsurance.io/en/bitbox/';
    }
  };

  const maybeProceed = async () => {
    // we force a detection to verify if there is any new insured account
    // before proceeding to the next step.
    await detect(false);
    navigate('/bitsurance/account');
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
                      <p className={`${style.cardBody2 || ''} ${style.errorMessage || ''}`}>
                        {t('bitsurance.detect.notInsured')}
                      </p>
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
