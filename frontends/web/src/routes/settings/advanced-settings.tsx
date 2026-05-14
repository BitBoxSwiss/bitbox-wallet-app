// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Main, Header, GuideWrapper, GuidedContent } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './types';
import { EnableCustomFeesToggleSetting } from './components/advanced-settings/enable-custom-fees-toggle-setting';
import { EnableCoinControlSetting } from './components/advanced-settings/enable-coin-control-setting';
import { ConnectFullNodeSetting } from './components/advanced-settings/connect-full-node-setting';
import { EnableTorProxySetting } from './components/advanced-settings/enable-tor-proxy-setting';
import { UnlockSoftwareKeystore } from './components/advanced-settings/unlock-software-keystore';
import { RestartInTestnetSetting } from './components/advanced-settings/restart-in-testnet-setting';
import { ExportLogSetting } from './components/advanced-settings/export-log-setting';
import { CustomGapLimitSettings } from './components/advanced-settings/custom-gap-limit-setting';
import { useConfig } from '@/contexts/ConfigProvider';
import { MobileHeader } from './components/mobile-header';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { EnableAuthSetting } from './components/advanced-settings/enable-auth-setting';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';

export const AdvancedSettings = ({ devices, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  const { config, setConfig } = useConfig();

  const deviceIDs = Object.keys(devices);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <GlobalBanners devices={devices} />
          </ContentWrapper>
          <Header
            hideSidebarToggler
            title={
              <>
                <h2 className="hide-on-small">{t('sidebar.settings')}</h2>
                <MobileHeader withGuide title={t('settings.advancedSettings')} />
              </>
            } />
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs
                devices={devices}
                hideMobileMenu
                hasAccounts={hasAccounts}
              >
                <EnableCustomFeesToggleSetting frontendConfig={config?.frontend} onChangeConfig={setConfig} />
                <EnableCoinControlSetting frontendConfig={config?.frontend} onChangeConfig={setConfig} />
                <EnableAuthSetting backendConfig={config?.backend} onChangeConfig={setConfig} />
                <EnableTorProxySetting proxyConfig={config?.backend?.proxy} onChangeConfig={setConfig} />
                <RestartInTestnetSetting onChangeConfig={setConfig} />
                <CustomGapLimitSettings backendConfig={config?.backend} onChangeConfig={setConfig} />
                <UnlockSoftwareKeystore deviceIDs={deviceIDs}/>
                <ConnectFullNodeSetting />
                <ExportLogSetting />
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <AdvancedSettingsGuide />
    </GuideWrapper>

  );
};


const AdvancedSettingsGuide = () => {
  const { t } = useTranslation();

  return (
    <Guide title={t('guide.guideTitle.advancedSettings')}>
      <Entry key="guide.settings-electrum.why" entry={{
        text: t('guide.settings-electrum.why.text'),
        title: t('guide.settings-electrum.why.title'),
      }} />
      <Entry key="guide.settings-electrum.tor" entry={{
        text: t('guide.settings-electrum.tor.text'),
        title: t('guide.settings-electrum.tor.title'),
      }} />
    </Guide>
  );
};
