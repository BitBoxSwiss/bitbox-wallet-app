// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { useConfig } from '@/contexts/ConfigProvider';

export const EnableOnionExplorerSetting = () => {
  const { t } = useTranslation();
  const { config, setConfig } = useConfig();

  const handleToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    await setConfig({
      frontend: {
        useOnionExplorerUrls: e.target.checked,
      },
    });
  };

  return (
    <SettingsItem
      settingName={t('settings.expert.onionExplorer')}
      secondaryText={t('newSettings.advancedSettings.onionExplorer.description')}
      extraComponent={
        config ? (
          <Toggle
            checked={config.frontend.useOnionExplorerUrls || false}
            onChange={handleToggle}
          />
        ) : null
      }
    />
  );
};
