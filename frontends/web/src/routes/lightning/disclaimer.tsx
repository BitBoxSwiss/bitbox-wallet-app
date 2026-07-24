// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { A } from '@/components/anchor/anchor';
import { Button } from '@/components/forms';
import { Header, Main } from '@/components/layout';
import { SubTitle } from '@/components/title';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SimpleMarkup } from '@/utils/markup';

export const LightningDisclaimerContent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <SubTitle>{t('lightning.disclaimer.securityModel.title')}</SubTitle>
      <SimpleMarkup tagName="p" markup={t('lightning.disclaimer.securityModel.content')} />

      <SubTitle>{t('lightning.disclaimer.backups.title')}</SubTitle>
      <p>{t('lightning.disclaimer.backups.content')}</p>

      <SubTitle>{t('lightning.disclaimer.trustModel.title')}</SubTitle>
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

      <SubTitle>{t('lightning.disclaimer.fees.title')}</SubTitle>
      <p>{t('lightning.disclaimer.fees.receiving.title')}</p>
      <p>{t('lightning.disclaimer.fees.receiving.content')}</p>
      <p>{t('lightning.disclaimer.fees.sending.title')}</p>
      <p>{t('lightning.disclaimer.fees.sending.content')}</p>

      <SubTitle>{t('lightning.disclaimer.beta.title')}</SubTitle>
      <p>{t('lightning.disclaimer.beta.content')}</p>
    </div>
  );
};

export const LightningDisclaimer = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Main>
      <Header title={<h2>{t('lightning.disclaimer.title')}</h2>} />
      <View>
        <ViewContent>
          <LightningDisclaimerContent />
        </ViewContent>
        <ViewButtons>
          <Button primary onClick={() => navigate('/settings/lightning-settings')}>
            {t('button.done')}
          </Button>
        </ViewButtons>
      </View>
    </Main>
  );
};
