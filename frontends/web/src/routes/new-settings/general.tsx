import { useEffect } from 'react';
import { View, ViewContent } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import { SettingsItemContainer } from './components/settingsItemContainer/settingsItemContainer';
import { route } from '../../utils/route';
import { useMediaQuery } from '../../hooks/mediaquery';

export const GeneralSettings = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  useEffect(() => {
    if (!isMobile) {
      route('/new-settings/appearance');
    }
  }, [isMobile]);
  return (
    <Main>
      <Header title={<h2>Settings</h2>} />
      <View fullscreen={false}>
        <ViewContent>

          <SettingsItemContainer
            settingName="Appearance"
            onClick={() => route('/new-settings/appearance')}
          />
          <SettingsItemContainer
            settingName="Manage Accounts"
            onClick={() => route('/new-settings/manage-accounts')}
          />
          <SettingsItemContainer
            settingName="Device Settings"
            onClick={() => route('/new-settings/device-settings')}
          />
          <SettingsItemContainer
            settingName="Advanced Settings"
            onClick={() => route('/new-settings/advanced-settings')}
          />
          <SettingsItemContainer
            settingName="About"
            onClick={() => route('/new-settings/about')}
          />
        </ViewContent>

      </View>
    </Main>
  );
};
