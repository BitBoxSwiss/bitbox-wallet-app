import { ReactNode } from 'react';
import { View, ViewContent } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import { DarkmodeToggleSetting } from './components/appearance/darkmodeToggleSetting';
import { DefaultCurrencyDropdownSetting } from './components/appearance/defaultCurrencyDropdownSetting';
import { DisplaySatsToggleSetting } from './components/appearance/displaySatsToggleSetting';
import { LanguageDropdownSetting } from './components/appearance/languageDropdownSetting';
import { ActiveCurrenciesDropdownSetting } from './components/appearance/activeCurrenciesDropdownSetting';
import style from './appearance.module.css';

const ContentContainer = ({ children }: {children: ReactNode}) => <div className={style.contentContainer}>{children}</div>;

export const Appearance = () => {
  return (
    <Main>
      <Header title={<h2>Settings</h2>} />
      <View fullscreen={false}>
        <ViewContent>
          <ContentContainer>
            <DefaultCurrencyDropdownSetting />
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
