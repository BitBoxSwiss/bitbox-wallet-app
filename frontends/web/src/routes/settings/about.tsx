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
import { Main, Header, GuideWrapper, GuidedContent } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { AppVersion } from './components/about/app-version-setting';
import { MobileHeader } from './components/mobile-header';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { TPagePropsWithSettingsTabs } from './types';

export const About = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
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
              <WithSettingsTabs deviceIDs={deviceIDs} hideMobileMenu hasAccounts={hasAccounts}>
                <AppVersion />
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
      <Entry key="guide.settings.servers" entry={t('guide.settings.servers')} />
    </Guide>
  );
};
