// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Main, Header, GuideWrapper, GuidedContent } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { DarkmodeToggleSetting } from './components/appearance/darkmodeToggleSetting';
import { NotesImport } from './components/appearance/notesImport';
import { NotesExport } from './components/appearance/notesExport';
import { DefaultCurrencyDropdownSetting } from './components/appearance/defaultCurrencyDropdownSetting';
import { LanguageDropdownSetting } from './components/appearance/languageDropdownSetting';
import { ActiveCurrenciesDropdownSetting } from './components/appearance/activeCurrenciesDropdownSetting';
import { WithSettingsTabs } from './components/tabs';
import { MobileHeader } from './components/mobile-header';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { SettingsContent, type TSettingsContentSection } from './components/settings-content';
import { SubTitle } from '@/components/title';
import { TPagePropsWithSettingsTabs } from './types';
import { GlobalBanners } from '@/components/banners';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { isNotesSettingsVisible } from './settings-availability';

type TProps = {
  hasAccounts: boolean;
};

export const General = ({ devices, hasAccounts }: TPagePropsWithSettingsTabs) => {
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
                <MobileHeader withGuide title={t('settings.general')} />
              </>
            } />
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs hasAccounts={hasAccounts} hideMobileMenu devices={devices}>
                <GeneralSettingsContent hasAccounts={hasAccounts} />
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <GeneralGuide />
    </GuideWrapper>

  );
};

export const GeneralSettingsContent = ({
  hasAccounts,
}: TProps) => {
  const { t } = useTranslation();

  const sections: TSettingsContentSection[] = [
    {
      id: 'appearance',
      items: [
        { id: 'language', content: <LanguageDropdownSetting /> },
        { id: 'default-currency', content: <DefaultCurrencyDropdownSetting /> },
        { id: 'active-currencies', content: <ActiveCurrenciesDropdownSetting /> },
        { id: 'dark-mode', content: <DarkmodeToggleSetting /> },
      ],
      title: <SubTitle>{t('settings.appearance')}</SubTitle>,
    },
    ...(isNotesSettingsVisible(hasAccounts) ? [{
      id: 'notes',
      items: [
        { id: 'export-notes', content: <NotesExport /> },
        { id: 'import-notes', content: <NotesImport /> },
      ],
      title: <SubTitle className="m-top-default">{t('settings.notes.title')}</SubTitle>,
    }] : []),
  ];

  return (
    <SettingsContent sections={sections} />
  );
};

const GeneralGuide = () => {
  const { t } = useTranslation();

  return (
    <Guide title={t('guide.guideTitle.appearance')}>
      <Entry key="guide.settings.sats" entry={{
        text: t('guide.settings.sats.text'),
        title: t('guide.settings.sats.title'),
      }} />
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
