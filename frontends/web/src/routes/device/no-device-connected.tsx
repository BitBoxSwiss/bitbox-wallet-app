// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Bluetooth } from '@/components/bluetooth/bluetooth';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { ViewContent, View } from '@/components/view/view';
import { WithSettingsTabs } from '@/routes/settings/components/tabs';
import { ManageDeviceGuide } from './bitbox02/settings-guide';
import styles from './no-device-connected.module.css';

export const NoDeviceConnected = () => {
  const { t } = useTranslation();

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            variant="navigation"
            desktopTitle={t('sidebar.settings')}
            hideSidebarToggler
            mobileBackButton
            title={t('sidebar.device')}
          />
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs hideMobileMenu>
                <div className={styles.noDevice}>
                  {t('deviceSettings.noDevice')}
                </div>
                <Bluetooth />
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <ManageDeviceGuide />
    </GuideWrapper>
  );
};
