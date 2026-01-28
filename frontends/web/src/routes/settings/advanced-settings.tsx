// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
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
import { getConfig } from '@/utils/config';
import { MobileHeader } from './components/mobile-header';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { EnableAuthSetting } from './components/advanced-settings/enable-auth-setting';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';

export type TProxyConfig = {
  proxyAddress: string;
  useProxy: boolean;
};

export type TFrontendConfig = {
  expertFee?: boolean;
  coinControl?: boolean;
};

export type TBackendConfig = {
  proxy?: TProxyConfig;
  authentication?: boolean;
  startInTestnet?: boolean;
  gapLimitReceive?: number;
  gapLimitChange?: number;
};

export type TConfig = {
  backend?: TBackendConfig;
  frontend?: TFrontendConfig;
};

export const AdvancedSettings = ({ devices, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  const fetchedConfig = useLoad(getConfig) as TConfig;
  const [config, setConfig] = useState<TConfig>();

  const frontendConfig = config?.frontend;
  const backendConfig = config?.backend;
  const proxyConfig = config?.backend?.proxy;

  useEffect(() => {
    setConfig(fetchedConfig);
  }, [fetchedConfig]);

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
                <EnableCustomFeesToggleSetting frontendConfig={frontendConfig} onChangeConfig={setConfig} />
                <EnableCoinControlSetting frontendConfig={frontendConfig} onChangeConfig={setConfig} />
                <EnableAuthSetting backendConfig={backendConfig} onChangeConfig={setConfig} />
                <EnableTorProxySetting proxyConfig={proxyConfig} onChangeConfig={setConfig} />
                <RestartInTestnetSetting onChangeConfig={setConfig} />
                <CustomGapLimitSettings backendConfig={backendConfig} onChangeConfig={setConfig} />
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
