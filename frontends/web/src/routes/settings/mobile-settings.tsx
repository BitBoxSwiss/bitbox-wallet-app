// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { View, ViewContent } from '@/components/view/view';
import { Header, Main } from '@/components/layout';
import { Tabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './types';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { useOnlyVisitableOnMobile } from '@/hooks/onlyvisitableonmobile';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { useNavigate } from 'react-router-dom';
/**
 * The "index" page of the settings
 * that will only be shown on Mobile.
 *
 * The data will be the same as the "tabs"
 * we see on Desktop, as it's the equivalent
 * of "tabs" on Mobile.
 **/
export const MobileSettings = ({ devices, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useOnlyVisitableOnMobile('/settings/general');
  const handleClick = () => {
    // go to home page if no devices or accounts (waiting.tsx will be shown)
    if (Object.keys(devices).length === 0 && !hasAccounts) {
      navigate('/');
    } else {
      navigate('/settings/more');
    }
  };
  return (
    <Main>
      <ContentWrapper>
        <GlobalBanners devices={devices} />
      </ContentWrapper>
      <Header
        title={
          <MobileHeader onClick={handleClick} title={t('settings.title')} />
        } />
      <View fullscreen={false}>
        <ViewContent>
          <Tabs devices={devices} hasAccounts={hasAccounts} />
        </ViewContent>
      </View>
    </Main>
  );
};
