import { View, ViewContent } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import { DarkmodeToggleSetting } from './components/appearance/darkmodeToggleSetting';
import { DefaultCurrencyDropdownSetting } from './components/appearance/defaultCurrencyDropdownSetting';
import { DisplaySatsToggleSetting } from './components/appearance/displaySatsToggleSetting';
import { LanguageDropdownSetting } from './components/appearance/languageDropdownSetting';
import { ActiveCurrenciesDropdownSettingWithStore } from './components/appearance/activeCurrenciesDropdownSetting';

export const Appearance = () => {
  return (
    <Main>
      <Header title={<h2>Settings</h2>} />
      <View fullscreen={false}>
        <ViewContent>
          <DefaultCurrencyDropdownSetting />
          <ActiveCurrenciesDropdownSettingWithStore />
          <LanguageDropdownSetting />
          <DarkmodeToggleSetting />
          <DisplaySatsToggleSetting />
        </ViewContent>
      </View>
    </Main>
  );
};