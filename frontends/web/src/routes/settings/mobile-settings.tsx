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
export const MobileSettings = ({
  devices,
  hasAccounts,
}: TPagePropsWithSettingsTabs) => {
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
        <GlobalBanners />
      </ContentWrapper>
      <Header
        title={
          <MobileHeader onClick={handleClick} title={t('settings.title')} />
        }
      />
      <View fullscreen={false}>
        <ViewContent>
          <Tabs devices={devices} hasAccounts={hasAccounts} />
        </ViewContent>
      </View>
    </Main>
  );
};
