// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { useConfig } from '@/contexts/ConfigProvider';

export const EnableCustomFeesToggleSetting = () => {
  const { t } = useTranslation();
  const { config, setConfig } = useConfig();

  const handleToggleFee = async (e: ChangeEvent<HTMLInputElement>) => {
    await setConfig({
      frontend: {
        expertFee: e.target.checked
      },
    });
  };

  return (
    <SettingsItem
      settingName={t('settings.expert.fee')}
      secondaryText={t('newSettings.advancedSettings.customFees.description')}
      extraComponent={
        config ? (
          <Toggle
            checked={config.frontend.expertFee || false}
            onChange={handleToggleFee}
          />
        ) : null
      }
    />
  );
};
