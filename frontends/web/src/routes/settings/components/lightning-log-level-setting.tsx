// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { getLightningLoggingRestartRequired } from '@/api/lightning';
import { Message } from '@/components/message/message';
import { Toggle } from '@/components/toggle/toggle';
import { useConfig } from '@/contexts/ConfigProvider';
import { LightningContext } from '@/contexts/LightningContext';
import { useLoad } from '@/hooks/api';
import { SettingsItem } from './settingsItem/settingsItem';

export const LightningLogLevelSetting = () => {
  const { t } = useTranslation();
  const { config, setConfig } = useConfig();
  const { lightningSDKStatus } = useContext(LightningContext);
  const showRestartMessage = useLoad(
    config === undefined ? null : getLightningLoggingRestartRequired,
    [config?.backend.lightningDebugLogs, lightningSDKStatus],
  );

  if (config === undefined) {
    return null;
  }

  return (
    <>
      {showRestartMessage ? (
        <Message type="warning">
          {t('settings.restart')}
        </Message>
      ) : null}
      <SettingsItem
        settingName={t('lightning.settings.enableDebugLogs')}
        extraComponent={
          <Toggle
            aria-label={t('lightning.settings.enableDebugLogs')}
            checked={config.backend.lightningDebugLogs}
            onChange={async event => {
              await setConfig({ backend: { lightningDebugLogs: event.target.checked } });
            }}
          />
        }
      />
    </>
  );
};
