// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TConfig, TFrontendConfig } from '@/api/config';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { useConfig } from '@/contexts/ConfigProvider';

type TProps = {
  frontendConfig?: TFrontendConfig;
  onChangeConfig: (config: TConfig) => void;
};

export const EnableCoinControlSetting = ({ frontendConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();
  const { setConfig } = useConfig();

  const handleToggleFee = async (e: ChangeEvent<HTMLInputElement>) => {
    const config = await setConfig({
      frontend: {
        coinControl: e.target.checked
      },
    });
    onChangeConfig(config);
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