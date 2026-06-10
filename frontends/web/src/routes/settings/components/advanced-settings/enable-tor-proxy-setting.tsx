// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@/contexts/ConfigProvider';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { TorProxyDialog } from './tor-proxy-dialog';
import { Message } from '@/components/message/message';
import { runningInIOS } from '@/utils/env';
import styles from './enable-tor-proxy-setting.module.css';

export const EnableTorProxySetting = () => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const [showTorProxyDialog, setShowTorProxyDialog] = useState(false);
  const [showRestartMessage, setShowRestartMessage] = useState(false);

  const proxyEnabled = config?.backend.proxy.useProxy ?? false;

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
        onCloseDialog={() => setShowTorProxyDialog(false)}
        handleShowRestartMessage={setShowRestartMessage}
      />
    </>
  );
};
