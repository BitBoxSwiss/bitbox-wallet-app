import { useTranslation } from 'react-i18next';
import { Main, Header } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { AppVersion } from './components/about/app-version-setting';

type TProps = {
  deviceIDs: string[]
}

export const About = ({ deviceIDs }: TProps) => {
  const { t } = useTranslation();
  return (
    <Main>
      <div className="hide-on-small"><Header title={<h2>{t('sidebar.settings')}</h2>} /></div>
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs subPageTitle={t('settings.about')} hideMobileMenu deviceIDs={deviceIDs}>
            <AppVersion />
          </WithSettingsTabs>
        </ViewContent>
      </View>
    </Main>
  );
};
