/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { Dispatch, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { ChevronRightDark } from '@/components/icon';
import { TorProxyDialog } from './tor-proxy-dialog';
import { Message } from '@/components/message/message';
import { TProxyConfig } from '@/routes/settings/advanced-settings';
import styles from './enable-tor-proxy-setting.module.css';

type TProps = {
  proxyConfig?: TProxyConfig;
  onChangeConfig: Dispatch<any>;
}

export const EnableTorProxySetting = ({ proxyConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();
  const [showTorProxyDialog, setShowTorProxyDialog] = useState(false);
  const [showRestartMessage, setShowRestartMessage] = useState(false);

  const proxyEnabled = proxyConfig ? proxyConfig.useProxy : false;

  return (
    <>
      { showRestartMessage ? (
        <Message type="warning">
          {t('settings.restart')}
        </Message>
      ) : null }
      <SettingsItem
        className={styles.settingItem}
        settingName={t('settings.expert.useProxy')}
        onClick={() => setShowTorProxyDialog(true)}
        secondaryText={t('newSettings.advancedSettings.torProxy.description')}
        displayedValue={proxyEnabled ? t('generic.enabled_true') : t('generic.enabled_false')}
        extraComponent={<ChevronRightDark width={24} height={24} />}
      />
      <TorProxyDialog
        open={showTorProxyDialog}
        proxyConfig={proxyConfig}
        onCloseDialog={() => setShowTorProxyDialog(false)}
        onChangeConfig={onChangeConfig}
        handleShowRestartMessage={setShowRestartMessage}
      />
    </>
  );
};