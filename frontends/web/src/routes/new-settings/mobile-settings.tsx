import { useEffect } from 'react';
import { View, ViewContent } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import { route } from '../../utils/route';
import { useMediaQuery } from '../../hooks/mediaquery';
import { Tabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './type';

/**
 * The "index" page of the settings
 * that will only be shown on Mobile.
 *
 * The data will be the same as the "tabs"
 * we see on Desktop, as it's the equivalent
 * of "tabs" on Mobile.
 **/
export const MobileSettings = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
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
          <Tabs deviceIDs={deviceIDs} hasAccounts={hasAccounts} />
        </ViewContent>
      </View>
    </Main>
  );
};