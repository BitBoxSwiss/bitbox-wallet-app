import { Main, Header } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { useTranslation } from 'react-i18next';
import { DarkmodeToggleSetting } from './components/appearance/darkmodeToggleSetting';
import { DefaultCurrencyDropdownSetting } from './components/appearance/defaultCurrencyDropdownSetting';
import { DisplaySatsToggleSetting } from './components/appearance/displaySatsToggleSetting';
import { LanguageDropdownSetting } from './components/appearance/languageDropdownSetting';
import { ActiveCurrenciesDropdownSettingWithStore } from './components/appearance/activeCurrenciesDropdownSetting';
import { WithSettingsTabs } from './components/tabs';

type TProps = {
  deviceIDs: string[]
}

export const Appearance = ({ deviceIDs }: TProps) => {
  const { t } = useTranslation();
  return (
    <Main>
      <div className="hide-on-small"><Header title={<h2>{t('sidebar.settings')}</h2>} /></div>
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs subPageTitle={t('settings.appearance')} hideMobileMenu deviceIDs={deviceIDs}>
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
