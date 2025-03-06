
/**
 * Copyright 2025 Shift Crypto AG
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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { Toggle } from '@/components/toggle/toggle';
import { TConfig, TBackendConfig } from '@/routes/settings/advanced-settings';
import { Message } from '@/components/message/message';
import { setConfig } from '@/utils/config';
import styles from './enable-tor-proxy-setting.module.css';

type TProps = {
  backendConfig?: TBackendConfig;
  onChangeConfig: Dispatch<TConfig>;
}

export const RestartInTestnetSetting = ({ backendConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();
  const [showRestartMessage, setShowRestartMessage] = useState(false);


  const handleToggleRestartInTestnet = async (e: ChangeEvent<HTMLInputElement>) => {
    setShowRestartMessage(e.target.checked);
    const config = await setConfig({
      backend: {
        'startInTestnet': e.target.checked
      },
    }) as TConfig;
    onChangeConfig(config);
  };
  return (
    <>
      { showRestartMessage ? (
        <Message type="warning">
          {t('settings.restart')}
        </Message>
      ) : null }
      <SettingsItem
        className={styles.settingItem}
        settingName={t('settings.expert.restartInTestnet')}
        secondaryText={t('newSettings.advancedSettings.restartInTestnet.description')}
        extraComponent={
          backendConfig !== undefined ? (
            <Toggle
              checked={backendConfig?.startInTestnet || false}
              onChange={handleToggleRestartInTestnet}
            />
          ) : null
        }
      />
    </>
  );
};
