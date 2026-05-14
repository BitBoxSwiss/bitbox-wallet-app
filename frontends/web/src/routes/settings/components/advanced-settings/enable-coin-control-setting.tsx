// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFrontendConfig } from '@/api/config';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { useConfig } from '@/contexts/ConfigProvider';

type TProps = {
  frontendConfig?: TFrontendConfig;
};

export const EnableCoinControlSetting = ({ frontendConfig }: TProps) => {
  const { t } = useTranslation();
  const { setConfig } = useConfig();

  const handleToggleFee = async (e: ChangeEvent<HTMLInputElement>) => {
    await setConfig({
      frontend: {
        coinControl: e.target.checked
      },
    });
  };

  return (
    <SettingsItem
      settingName={t('settings.expert.coinControl')}
      secondaryText={t('newSettings.advancedSettings.coinControl.description')}
      extraComponent={
        frontendConfig !== undefined ? (
          <Toggle
            checked={frontendConfig?.coinControl || false}
            onChange={handleToggleFee}
          />
        ) : null
      }
    />
  );
};