import { ReactNode } from 'react';
import { View, ViewContent } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import { DarkmodeToggleSetting } from './components/settingsItems/darkmodeToggleSetting';
import { DefaultCurrencySetting } from './components/settingsItems/defaultCurrencySetting';
import { DisplaySatsToggleSetting } from './components/settingsItems/displaySatsToggleSetting';
import style from './appearance.module.css';
import { LanguageDropdownSetting } from './components/settingsItems/languageDropdownSetting';
import { ActiveCurrenciesDropdownSetting } from './components/settingsItems/activeCurrenciesDropdownSetting';

const ContentContainer = ({ children }: {children: ReactNode}) => <div className={style.contentContainer}>{children}</div>;

export const Appearance = () => {
  return (
    <Main>
      <Header title={<h2>Settings</h2>} />
      <View fullscreen={false}>
        <ViewContent>
          <ContentContainer>
            <DefaultCurrencySetting />
            <ActiveCurrenciesDropdownSetting />
            <LanguageDropdownSetting />
            <DarkmodeToggleSetting />
            <DisplaySatsToggleSetting />
          </ContentContainer>
        </ViewContent>
      </View>
    </Main>
  );
};
