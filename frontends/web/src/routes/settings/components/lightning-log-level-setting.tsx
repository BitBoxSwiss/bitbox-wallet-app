// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Message } from '@/components/message/message';
import { Toggle } from '@/components/toggle/toggle';
import { useConfig } from '@/contexts/ConfigProvider';
import { SettingsItem } from './settingsItem/settingsItem';

export const LightningLogLevelSetting = () => {
  const { t } = useTranslation();
  const { config, initialLightningDebugLogs, setConfig } = useConfig();

  if (config === undefined) {
    return null;
  }

  const showRestartMessage = (
    initialLightningDebugLogs !== undefined
    && initialLightningDebugLogs !== config.backend.lightningDebugLogs
  );

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
