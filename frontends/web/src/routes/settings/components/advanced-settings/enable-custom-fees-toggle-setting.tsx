/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ChangeEvent, Dispatch } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { TConfig, TFrontendConfig } from '@/routes/settings/advanced-settings';
import { setConfig } from '@/utils/config';

type TProps = {
  frontendConfig?: TFrontendConfig;
  onChangeConfig: Dispatch<TConfig>;
}

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
        frontendConfig !== undefined ?
          <Toggle
            checked={frontendConfig?.expertFee || false}
            onChange={handleToggleFee}
          />
          :
          null
      }
    />
  );
};