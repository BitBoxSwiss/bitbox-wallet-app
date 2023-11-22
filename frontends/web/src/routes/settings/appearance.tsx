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

import { Main, Header, GuideWrapper, GuidedContent } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { useTranslation } from 'react-i18next';
import { DarkmodeToggleSetting } from './components/appearance/darkmodeToggleSetting';
import { DefaultCurrencyDropdownSetting } from './components/appearance/defaultCurrencyDropdownSetting';
import { DisplaySatsToggleSetting } from './components/appearance/displaySatsToggleSetting';
import { LanguageDropdownSetting } from './components/appearance/languageDropdownSetting';
import { ActiveCurrenciesDropdownSettingWithStore } from './components/appearance/activeCurrenciesDropdownSetting';
import { HideAmountsSetting } from './components/appearance/hideAmountsSetting';
import { WatchonlySetting } from './components/appearance/watchonlySetting';
import { WithSettingsTabs } from './components/tabs';
import { MobileHeader } from './components/mobile-header';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { TPagePropsWithSettingsTabs } from './types';

export const Appearance = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
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
                <MobileHeader withGuide title={t('settings.appearance')} />
              </>
            } />
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs hasAccounts={hasAccounts} hideMobileMenu deviceIDs={deviceIDs}>
                <DefaultCurrencyDropdownSetting />
                <ActiveCurrenciesDropdownSettingWithStore />
                <LanguageDropdownSetting />
                <DarkmodeToggleSetting />
                <DisplaySatsToggleSetting />
                <HideAmountsSetting />
                <WatchonlySetting />
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <AppearanceGuide />
    </GuideWrapper>

  );
};

const AppearanceGuide = () => {
  const { t } = useTranslation();

  return (
    <Guide>
      <Entry key="guide.settings.sats" entry={t('guide.settings.sats')} />
      <Entry key="guide.accountRates" entry={{
        link: {
          text: 'www.coingecko.com',
          url: 'https://www.coingecko.com/'
        },
        text: t('guide.accountRates.text'),
        title: t('guide.accountRates.title')
      }} />

    </Guide>
  );
};
