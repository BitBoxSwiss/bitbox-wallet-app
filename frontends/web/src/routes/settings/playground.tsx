// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useDesktopModernized } from '@/components/desktop-chrome/desktop-chrome';
import { Main, Header } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { runningInQtWebEngine } from '@/utils/env';
import { WithSettingsTabs } from './components/tabs';
import { DesktopAppearanceSettings } from './components/appearance/desktop-appearance-settings';

export const Playground = () => {
  const { t } = useTranslation();
  const desktop = useDesktopModernized();
  if (!runningInQtWebEngine()) {
    return <Navigate replace to="/settings/general" />;
  }
  if (!desktop) {
    return null;
  }
  return (
    <Main>
      <Header variant="navigation" desktopTitle={t('sidebar.settings')} title={t('desktopDesign.title')} hideSidebarToggler mobileBackButton />
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs hideMobileMenu>
            <DesktopAppearanceSettings />
          </WithSettingsTabs>
        </ViewContent>
      </View>
    </Main>
  );
};
