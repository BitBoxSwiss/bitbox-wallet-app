// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { A } from '@/components/anchor/anchor';
import { Button } from '@/components/forms';
import { Header, Main } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { SimpleMarkup } from '@/utils/markup';
import termsStyles from '@/components/terms/terms.module.css';

type TProps = {
  children: ReactNode;
  title?: string;
};

export const LightningDisclaimerContent = ({ children, title }: TProps) => {
  const { t } = useTranslation();

  return (
    <View scrollableContent>
      <ViewContent fullWidth>
        <div className={termsStyles.disclaimerContainer}>
          <div className={termsStyles.disclaimer}>
            {title && <h2 className={termsStyles.title}>{title}</h2>}
            <h2 className={termsStyles.title}>
              {t('lightning.disclaimer.securityModel.title')}
            </h2>
            <SimpleMarkup tagName="p" markup={t('lightning.disclaimer.securityModel.content')} />

            <h2 className={termsStyles.title}>
              {t('lightning.disclaimer.backups.title')}
            </h2>
            <p>{t('lightning.disclaimer.backups.content')}</p>

            <h2 className={termsStyles.title}>
              {t('lightning.disclaimer.trustModel.title')}
            </h2>
            <p>{t('lightning.disclaimer.trustModel.content')}</p>
            <p>
              <A href="https://www.spark.money/">
                {t('lightning.disclaimer.trustModel.sparkLink')}
              </A>
              <br />
              <A href="https://breez.technology/sdk/">
                {t('lightning.disclaimer.trustModel.breezLink')}
              </A>
            </p>

            <h2 className={termsStyles.title}>
              {t('lightning.disclaimer.fees.title')}
            </h2>
            <h2 className={termsStyles.title}>
              {t('lightning.disclaimer.fees.receiving.title')}
            </h2>
            <p>{t('lightning.disclaimer.fees.receiving.content')}</p>
            <h2 className={termsStyles.title}>
              {t('lightning.disclaimer.fees.sending.title')}
            </h2>
            <p>{t('lightning.disclaimer.fees.sending.content')}</p>

            <h2 className={termsStyles.title}>
              {t('lightning.disclaimer.beta.title')}
            </h2>
            <p>{t('lightning.disclaimer.beta.content')}</p>
          </div>
        </div>
      </ViewContent>
      <ViewButtons>
        {children}
      </ViewButtons>
    </View>
  );
};

export const LightningDisclaimer = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Main>
      <Header title={
        <>
          <h2 className="hide-on-small">{t('lightning.disclaimer.title')}</h2>
          <MobileHeader title={t('lightning.disclaimer.title')} />
        </>
      } />
      <LightningDisclaimerContent>
        <Button primary onClick={() => navigate(-1)}>
          {t('button.done')}
        </Button>
      </LightningDisclaimerContent>
    </Main>
  );
};
