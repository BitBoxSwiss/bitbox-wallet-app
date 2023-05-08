import { Main, Header } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { useTranslation } from 'react-i18next';
import { DarkmodeToggleSetting } from './components/appearance/darkmodeToggleSetting';
import { DefaultCurrencyDropdownSetting } from './components/appearance/defaultCurrencyDropdownSetting';
import { DisplaySatsToggleSetting } from './components/appearance/displaySatsToggleSetting';
import { LanguageDropdownSetting } from './components/appearance/languageDropdownSetting';
import { ActiveCurrenciesDropdownSettingWithStore } from './components/appearance/activeCurrenciesDropdownSetting';
import { WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './type';

export const Appearance = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  return (
    <Main>
      <div className="hide-on-small"><Header title={<h2>{t('sidebar.settings')}</h2>} /></div>
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs subPageTitle={t('settings.appearance')} hasAccounts={hasAccounts} hideMobileMenu deviceIDs={deviceIDs}>
            <DefaultCurrencyDropdownSetting />
            <ActiveCurrenciesDropdownSettingWithStore />
            <LanguageDropdownSetting />
            <DarkmodeToggleSetting />
            <DisplaySatsToggleSetting />
          </WithSettingsTabs>
        </ViewContent>
      </View>
    </Main>
  );
};
