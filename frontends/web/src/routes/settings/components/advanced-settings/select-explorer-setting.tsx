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

import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightDark } from '@/components/icon';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export const SelectExplorerSetting = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <SettingsItem
      settingName={t('settings.expert.explorer.title')}
      onClick={() => navigate('/settings/select-explorer')}
      secondaryText={t('settings.expert.explorer.description')}
      extraComponent={
        <ChevronRightDark
          width={24}
          height={24}
        />
      }
    />
  );
};
