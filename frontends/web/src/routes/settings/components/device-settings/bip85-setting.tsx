/**
 * Copyright 2024 Shift Crypto AG
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

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { WarningOLD } from '@/components/icon';

type TProps = {
  deviceID: string;
  canBIP85: boolean;
}

export const Bip85Setting = ({ canBIP85, deviceID }: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!canBIP85) {
    return (
      <SettingsItem
        settingName={t('deviceSettings.expert.bip85.title')}
        secondaryText={t('deviceSettings.expert.bip85.description')}
        extraComponent={<WarningOLD width={20} height={20} />}
        displayedValue={t('bitbox02Wizard.advanced.outOfDate')}
      />
    );
  }
  return (
    <SettingsItem
      onClick={() => navigate(`/settings/device-settings/bip85/${deviceID}`)}
      settingName={t('deviceSettings.expert.bip85.title')}
      secondaryText={t('deviceSettings.expert.bip85.description')}
    />
  );
};
