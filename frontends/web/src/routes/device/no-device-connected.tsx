// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TPagePropsWithSettingsTabs } from '../settings/types';
import { Bluetooth } from '@/components/bluetooth/bluetooth';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { ViewContent, View } from '@/components/view/view';
import { GlobalBanners } from '@/components/banners';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { WithSettingsTabs } from '@/routes/settings/components/tabs';
import { ManageDeviceGuide } from './bitbox02/settings-guide';
import styles from './no-device-connected.module.css';

export const NoDeviceConnected = ({
  devices,
  hasAccounts,
}: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <ContentWrapper>
            <GlobalBanners devices={devices} />
          </ContentWrapper>
          <Header
            hideSidebarToggler
            title={
              <>
                <h2 className="hide-on-small">{t('sidebar.settings')}</h2>
                <MobileHeader withGuide title={t('sidebar.device')} />
              </>
            }/>
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs
                devices={devices}
                hideMobileMenu
                hasAccounts={hasAccounts}
              >
                <div className={styles.noDevice}>
                  {t('deviceSettings.noDevice')}
                </div>
                <Bluetooth />
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </GuidedContent>
        <ManageDeviceGuide />
      </GuideWrapper>
    </Main>
  );
};
