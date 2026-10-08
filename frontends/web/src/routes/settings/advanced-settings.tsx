// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Main, Header, GuideWrapper, GuidedContent } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { EnableCustomFeesToggleSetting } from './components/advanced-settings/enable-custom-fees-toggle-setting';
import { EnableCoinControlSetting } from './components/advanced-settings/enable-coin-control-setting';
import { ConnectFullNodeSetting } from './components/advanced-settings/connect-full-node-setting';
import { EnableTorProxySetting } from './components/advanced-settings/enable-tor-proxy-setting';
import { LightningSettingsSetting } from './components/advanced-settings/lightning-settings-setting';
import { UnlockSoftwareKeystore } from './components/advanced-settings/unlock-software-keystore';
import { RestartInTestnetSetting } from './components/advanced-settings/restart-in-testnet-setting';
import { ExportLogSetting } from './components/advanced-settings/export-log-setting';
import { ClearCacheSetting } from './components/advanced-settings/clear-cache-setting';
import { CustomGapLimitSettings } from './components/advanced-settings/custom-gap-limit-setting';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { EnableAuthSetting } from './components/advanced-settings/enable-auth-setting';
import { SettingsContent, type TSettingsContentSection } from './components/settings-content';
import { AppContext } from '@/contexts/AppContext';
import { useAppState } from '@/contexts/app-state-context';
import { isLightningFeatureAvailable } from '@/utils/env';
import {
  isExportLogsSettingVisible,
  isScreenLockSettingVisible,
  isTestWalletSettingVisible,
} from './settings-availability';

export const AdvancedSettings = () => {
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
            title={t('settings.advancedSettings')}
          />
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs hideMobileMenu>
                <AdvancedSettingsContent />
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <AdvancedSettingsGuide />
    </GuideWrapper>
  );
};

export const AdvancedSettingsContent = () => {
  const { isTesting } = useContext(AppContext);
  const { deviceIDs } = useAppState();

  const sections: TSettingsContentSection[] = [
    {
      id: 'advanced-settings',
      items: [
        ...(isLightningFeatureAvailable() ? [{
          id: 'lightning-settings',
          content: <LightningSettingsSetting />,
        }] : []),
        { id: 'custom-fees', content: <EnableCustomFeesToggleSetting /> },
        { id: 'coin-control', content: <EnableCoinControlSetting /> },
        ...(isScreenLockSettingVisible() ? [{
          id: 'screen-lock',
          content: <EnableAuthSetting />,
        }] : []),
        { id: 'tor-proxy', content: <EnableTorProxySetting /> },
        { id: 'testnet-mode', content: <RestartInTestnetSetting /> },
        { id: 'gap-limit', content: <CustomGapLimitSettings /> },
        ...(isTestWalletSettingVisible({ deviceIDs, isTesting }) ? [{
          id: 'test-wallet',
          content: <UnlockSoftwareKeystore />,
        }] : []),
        { id: 'full-node', content: <ConnectFullNodeSetting /> },
        { id: 'clear-cache', content: <ClearCacheSetting /> },
        ...(isExportLogsSettingVisible() ? [{
          id: 'export-logs',
          content: <ExportLogSetting />,
        }] : []),
      ],
    },
  ];

  return <SettingsContent sections={sections} />;
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
