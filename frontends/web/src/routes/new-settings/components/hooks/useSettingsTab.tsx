import { Main, Header } from '../../../../components/layout';
import { View, ViewContent } from '../../../../components/view/view';
import { Tabs } from '../tabs';
import { MobileHeader } from '../mobileheader';
import { useTranslation } from 'react-i18next';

export type TTab = {
  url: string;
  tabName: string;
}

const useSettingsTab = (Component: () => JSX.Element) => {

  const { t } = useTranslation();

  const settingsTabsDetail: TTab[] = [
    { url: '/new-settings/appearance', tabName: t('settings.appearance') },
    { url: '/new-settings/manage-accounts', tabName: 'Manage accounts' },
    { url: '/new-settings/device-settings', tabName: 'Device settings' },
    { url: '/new-settings/advanced-settings', tabName: 'Advanced settings' },
    { url: '/new-settings/about', tabName: 'About' },
  ];

  const ComponentWithTabs = () => (
    <Main>
      <div className="hide-on-small"><Header title={<h2>Settings</h2>} /></div>
      <View fullscreen={false}>
        <ViewContent>
          <div className="show-on-small">
            <MobileHeader settingsTabsDetail={settingsTabsDetail} />
          </div>
          <div className="hide-on-small">
            <Tabs settingsTabsDetail={settingsTabsDetail} />
          </div>
          <Component />
        </ViewContent>
      </View>
    </Main>
  );
  return ComponentWithTabs;
};


export default useSettingsTab;