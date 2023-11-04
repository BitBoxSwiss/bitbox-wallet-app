/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../hooks/api';
import { Main, Header, GuideWrapper, GuidedContent } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './types';
import { EnableCustomFeesToggleSetting } from './components/advanced-settings/enable-custom-fees-toggle-setting';
import { EnableCoinControlSetting } from './components/advanced-settings/enable-coin-control-setting';
import { ConnectFullNodeSetting } from './components/advanced-settings/connect-full-node-setting';
import { EnableTorProxySetting } from './components/advanced-settings/enable-tor-proxy-setting';
import { getConfig } from '../../utils/config';
import { MobileHeader } from './components/mobile-header';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { EnableExplorerSetting } from './components/advanced-settings/enable-explorer-setting';
import { debug } from '../../utils/env';
import { getTesting } from '../../api/backend';

export type TProxyConfig = {
  proxyAddress: string;
  useProxy: boolean;
}

export type TBitcoinExplorerConfig = {
  explorerURL: string;
  useCustomBlockExplorer: boolean;
}

export type TBitcoinConfig = {
  explorer: TBitcoinExplorerConfig;
}

export type TFrontendConfig = {
  expertFee?: boolean;
  coinControl?: boolean;
}

type TBackendConfig = {
  proxy?: TProxyConfig
  btc?: TBitcoinConfig
  tbtc?: TBitcoinConfig
}

export type TConfig = {
  backend?: TBackendConfig
  frontend?: TFrontendConfig
}

export const AdvancedSettings = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const testing = useLoad(debug ? getTesting : () => Promise.resolve(false));
  const { t } = useTranslation();
  const fetchedConfig = useLoad(getConfig) as TConfig;
  const [config, setConfig] = useState<TConfig>();

  const frontendConfig = config?.frontend;
  const proxyConfig = config?.backend?.proxy;
  const bitcoinConfig = testing ? config?.backend?.tbtc : config?.backend?.btc;

  useEffect(() => {
    setConfig(fetchedConfig);
  }, [fetchedConfig]);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
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
                deviceIDs={deviceIDs}
                hideMobileMenu
                hasAccounts={hasAccounts}
              >
                <EnableCustomFeesToggleSetting frontendConfig={frontendConfig} onChangeConfig={setConfig} />
                <EnableCoinControlSetting frontendConfig={frontendConfig} onChangeConfig={setConfig} />
                <EnableTorProxySetting proxyConfig={proxyConfig} onChangeConfig={setConfig} />
                <EnableExplorerSetting bitcoinConfig={bitcoinConfig} onChangeConfig={setConfig} />
                <ConnectFullNodeSetting />
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
    <Guide>
      <Entry key="guide.settings-electrum.why" entry={t('guide.settings-electrum.why')} />
      <Entry key="guide.settings-electrum.tor" entry={t('guide.settings-electrum.tor')} />
    </Guide>
  );
};
