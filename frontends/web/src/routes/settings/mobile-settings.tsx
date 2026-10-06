// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '@/contexts/app-state-context';
import { View, ViewContent } from '@/components/view/view';
import { Header, Main } from '@/components/layout';
import { useOnlyVisitableOnMobile } from '@/hooks/onlyvisitableonmobile';
import { Tabs, WithSettingsTabs } from './components/tabs';

/**
 * The "index" page of the settings
 * that will only be shown on Mobile.
 *
 * The data will be the same as the "tabs"
 * we see on Desktop, as it's the equivalent
 * of "tabs" on Mobile.
 **/
export const MobileSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useOnlyVisitableOnMobile('/settings/general');
  const { hasBottomNavigation } = useAppState();

  return (
    <Main>
      <Header
        variant="navigation"
        desktopTitle={null}
        mobileBackButton={!hasBottomNavigation}
        onBack={hasBottomNavigation ? undefined : () => navigate('/')}
        title={t('settings.title')}
      />
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs renderDefaultTabs={false}>
            <Tabs />
          </WithSettingsTabs>
        </ViewContent>
      </View>
    </Main>
  );
};
