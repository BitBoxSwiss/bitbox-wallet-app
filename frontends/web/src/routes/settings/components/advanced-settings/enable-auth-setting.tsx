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

import { ChangeEvent, Dispatch } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { TBackendConfig, TConfig } from '@/routes/settings/advanced-settings';
import { setConfig } from '@/utils/config';
import { onAuthSettingChanged, TAuthEventObject, subscribeAuth, forceAuth } from '@/api/backend';
import { runningInAndroid, runningInIOS } from '@/utils/env';

type TProps = {
  backendConfig?: TBackendConfig;
  onChangeConfig: Dispatch<TConfig>;
};

export const EnableAuthSetting = ({ backendConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();

  const handleToggleAuth = async (e: ChangeEvent<HTMLInputElement>) => {
    // Before updating the config we need the user to authenticate.
    // The forceAuth is needed to force the backend to execute the
    // authentication even if the auth config is disabled.
    const unsubscribe = subscribeAuth((data: TAuthEventObject) => {
      if (data.typ === 'auth-result') {
        if (data.result === 'authres-ok') {
          updateConfig(!e.target.checked);
          unsubscribe();
        }
        if (data.result === 'authres-cancel') {
        // if the user canceled the auth, we leave everything as is.
          unsubscribe();
        }

      }
    });
    forceAuth();
  };

  const updateConfig = async (auth: boolean) => {
    const config = await setConfig({
      backend: { authentication: auth },
    }) as TConfig;
    onAuthSettingChanged();
    onChangeConfig(config);
  };

  if (!runningInAndroid() && !runningInIOS()) {
    return null;
  }

  return (
    <SettingsItem
      settingName={t('newSettings.advancedSettings.authentication.title')}
      secondaryText={t('newSettings.advancedSettings.authentication.description')}
      extraComponent={
        backendConfig !== undefined ? (
          <Toggle
            checked={backendConfig?.authentication || false}
            onChange={handleToggleAuth}
          />
        ) : null
      }
    />
  );
};
