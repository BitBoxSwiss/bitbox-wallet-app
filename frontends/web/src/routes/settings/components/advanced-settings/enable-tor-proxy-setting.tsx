// SPDX-License-Identifier: Apache-2.0

import { Dispatch, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TProxyConfig } from '@/routes/settings/advanced-settings';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { TorProxyDialog } from './tor-proxy-dialog';
import { Message } from '@/components/message/message';
import { runningInIOS } from '@/utils/env';
import styles from './enable-tor-proxy-setting.module.css';
type TProps = {
  proxyConfig?: TProxyConfig;
  onChangeConfig: Dispatch<any>;
};

export const EnableTorProxySetting = ({ proxyConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();
  const [showTorProxyDialog, setShowTorProxyDialog] = useState(false);
  const [showRestartMessage, setShowRestartMessage] = useState(false);

  const proxyEnabled = proxyConfig ? proxyConfig.useProxy : false;

  // NOTE: if you enable this again on iOS, also enable it in the backend, where it is also disabled.
  const isIOS = runningInIOS();
  const displayedValue = (
    isIOS
      ? t('generic.noOptionOnIos')
      : proxyEnabled
        ? t('generic.enabled_true')
        : t('generic.enabled_false')
  );

  return (
    <>
      { showRestartMessage ? (
        <Message className={styles.restartMessage} type="warning">
          {t('settings.restart')}
        </Message>
      ) : null }
      <SettingsItem
        className={styles.torProxyContainer}
        settingName={t('settings.expert.useProxy')}
        onClick={isIOS ? undefined : () => setShowTorProxyDialog(true)}
        secondaryText={t('newSettings.advancedSettings.torProxy.description')}
        displayedValue={displayedValue}
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
