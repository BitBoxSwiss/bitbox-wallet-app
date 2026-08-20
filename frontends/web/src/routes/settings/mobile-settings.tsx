// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { View, ViewContent } from '@/components/view/view';
import { Header, Main } from '@/components/layout';
import { Tabs, WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './types';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { useOnlyVisitableOnMobile } from '@/hooks/onlyvisitableonmobile';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { useNavigate } from 'react-router-dom';

type TProps = TPagePropsWithSettingsTabs & {
  showBottomNavigation: boolean;
};

/**
 * The "index" page of the settings
 * that will only be shown on Mobile.
 *
 * The data will be the same as the "tabs"
 * we see on Desktop, as it's the equivalent
 * of "tabs" on Mobile.
 **/
export const MobileSettings = ({ devices, hasAccounts, showBottomNavigation }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useOnlyVisitableOnMobile('/settings/general');
  return (
    <Main>
      <ContentWrapper>
        <GlobalBanners devices={devices} />
      </ContentWrapper>
      <Header
        title={
          <MobileHeader
            onClick={showBottomNavigation ? undefined : () => navigate('/')}
            title={t('settings.title')}
            variant={showBottomNavigation ? 'titleOnly' : 'back'}
          />
        } />
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs devices={devices} hasAccounts={hasAccounts} renderDefaultTabs={false}>
            <Tabs devices={devices} hasAccounts={hasAccounts} />
          </WithSettingsTabs>
        </ViewContent>
      </View>
    </Main>
  );
};
