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

import { useLoad } from '@/hooks/api';
import { useTranslation } from 'react-i18next';
import { getUpdate, getVersion } from '@/api/version';
import { open } from '@/api/system';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { StyledSkeleton } from '@/routes/settings/bb02-settings';
import { Checked, RedDot } from '@/components/icon';
import { downloadLinkByLanguage } from '@/components/appdownloadlink/appdownloadlink';

export const AppVersion = () => {
  const { t } = useTranslation();

  const version = useLoad(getVersion);
  const update = useLoad(getUpdate);

  const secondaryText = !!update
    ? t('settings.info.out-of-date')
    : t('settings.info.up-to-date');
  const icon = !!update ? <RedDot width={8} height={8} /> : <Checked />;
  const versionNumber = !!version ? version : '-';

  if (update === undefined) {
    return <StyledSkeleton />;
  }

  return (
    <SettingsItem
      settingName={t('newSettings.about.appVersion.title')}
      secondaryText={secondaryText}
      displayedValue={versionNumber}
      extraComponent={icon}
      onClick={update ? () => open(downloadLinkByLanguage()) : undefined}
    />
  );
};
