// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Main, Header, GuideWrapper, GuidedContent } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { AppVersion } from './components/about/app-version-setting';
import { MobileHeader } from './components/mobile-header';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { TPagePropsWithSettingsTabs } from './types';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { FeedbackLink } from './components/about/feedback-link-setting';
import { SupportLink } from './components/about/support-link-setting';

export const About = ({ devices, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <GlobalBanners devices={devices} />
          </ContentWrapper>
          <Header
            hideSidebarToggler
            title={
              <>
                <h2 className="hide-on-small">{t('sidebar.settings')}</h2>
                <MobileHeader withGuide title={t('settings.about')} />
              </>
            } />
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs devices={devices} hideMobileMenu hasAccounts={hasAccounts}>
                <AppVersion />
                <FeedbackLink />
                <SupportLink />
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <AboutGuide />
    </GuideWrapper>
  );
};


const AboutGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="guide.settings.servers" entry={{
        text: t('guide.settings.servers.text'),
        title: t('guide.settings.servers.title'),
      }} />
    </Guide>
  );
};
