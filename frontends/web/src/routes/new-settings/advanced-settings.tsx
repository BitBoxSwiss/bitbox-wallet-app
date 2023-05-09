/**
 * Copyright 2023 Shift Devices AG
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
import { Main, Header } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './type';
import { EnableCustomFeesToggleSetting } from './components/advanced-settings/enable-custom-fees-toggle-setting';
import { ConnectFullNodeSetting } from './components/advanced-settings/connect-full-node-setting';
import { EnableTorProxySetting } from './components/advanced-settings/enable-tor-proxy-setting';
import { getConfig } from '../../api/backend';

export type TProxyConfig = {
  proxyAddress: string;
  useProxy: boolean;
}

export type TFrontendConfig = {
  expertFee?: boolean;
}

type TBackendConfig = {
  proxy?: TProxyConfig
}

export type TConfig = {
  backend?: TBackendConfig
  frontend?: TFrontendConfig
}

export const AdvancedSettings = ({ deviceIDs, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  const fetchedConfig = useLoad(getConfig);
  const [config, setConfig] = useState<TConfig>();

  const frontendConfig = config?.frontend;
  const proxyConfig = config?.backend?.proxy;

  useEffect(() => {
    setConfig(fetchedConfig);
  }, [fetchedConfig]);

  return (
    <Main>
      <div className="hide-on-small"><Header title={<h2>{t('sidebar.settings')}</h2>} /></div>
      <View fullscreen={false}>
        <ViewContent>
          <WithSettingsTabs
            deviceIDs={deviceIDs}
            hideMobileMenu
            hasAccounts={hasAccounts}
            subPageTitle={t('settings.advancedSettings')}
          >
            <EnableCustomFeesToggleSetting frontendConfig={frontendConfig} onChangeConfig={setConfig} />
            <EnableTorProxySetting proxyConfig={proxyConfig} onChangeConfig={setConfig} />
            <ConnectFullNodeSetting />
          </WithSettingsTabs>
        </ViewContent>
      </View>
    </Main>
  );
};
