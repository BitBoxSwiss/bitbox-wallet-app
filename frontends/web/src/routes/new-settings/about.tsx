import { useTranslation } from 'react-i18next';
import { Main, Header } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { AppVersion } from './components/about/app-version-setting';
import { TPagePropsWithSettingsTabs } from './type';


export const About = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  return (
    <Main>
      <div className="hide-on-small"><Header title={<h2>{t('sidebar.settings')}</h2>} /></div>
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs deviceIDs={deviceIDs} hideMobileMenu hasAccounts={hasAccounts} subPageTitle={t('settings.about')}>
            <AppVersion />
          </WithSettingsTabs>
        </ViewContent>
      </View>
    </Main>
  );
};
