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

export const EnableCustomFeesToggleSetting = ({ frontendConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();

  const handleToggleFee = async (e: ChangeEvent<HTMLInputElement>) => {
    const config = await setConfig({
      frontend: {
        'expertFee': e.target.checked
      },
    }) as TConfig;
    onChangeConfig(config);
  };

  return (
    <SettingsItem
      settingName={t('settings.expert.fee')}
      secondaryText={t('newSettings.advancedSettings.customFees.description')}
      extraComponent={
        frontendConfig !== undefined ? (
          <Toggle
            checked={frontendConfig?.expertFee || false}
            onChange={handleToggleFee}
          />
        ) : null
      }
    />
  );
};