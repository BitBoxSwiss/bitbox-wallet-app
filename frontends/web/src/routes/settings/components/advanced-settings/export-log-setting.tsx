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

import { TFunction, useTranslation } from 'react-i18next';
import { SettingsItem } from '../settingsItem/settingsItem';
import { ChevronRightDark } from '../../../../components/icon';
import { runningInAndroid, debug } from '../../../../utils/env';
import { alertUser } from '../../../../components/alert/Alert';
import { exportLogs } from '../../../../api/backend';

const logs = async (t: TFunction) => {
  try {
    const result = await exportLogs();
    if (result !== null && !result.success) {
      alertUser(result.errorMessage || t('genericError'));
    }
  } catch (err) {
    console.error(err);
  }
};

export const ExportLogSetting = () => {
  const { t } = useTranslation();
  return (debug === true || runningInAndroid()) ? null : (
    <SettingsItem
      settingName={t('settings.expert.exportLogs.title')}
      onClick={() => logs(t)}
      secondaryText={t('settings.expert.exportLogs.description')}
      extraComponent={
        <ChevronRightDark
          width={24}
          height={24}
        />
      }
    />
  );
};