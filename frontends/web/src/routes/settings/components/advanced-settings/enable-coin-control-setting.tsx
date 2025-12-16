// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, Dispatch } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { TConfig, TFrontendConfig } from '@/routes/settings/advanced-settings';
import { setConfig } from '@/utils/config';

type TProps = {
  frontendConfig?: TFrontendConfig;
  onChangeConfig: Dispatch<TConfig>;
};

export const EnableCoinControlSetting = ({ frontendConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();

  const handleToggleFee = async (e: ChangeEvent<HTMLInputElement>) => {
    const config = await setConfig({
      frontend: {
        'coinControl': e.target.checked
      },
    }) as TConfig;
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