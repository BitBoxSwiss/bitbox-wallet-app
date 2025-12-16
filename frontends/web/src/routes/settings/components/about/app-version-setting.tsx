// SPDX-License-Identifier: Apache-2.0

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

  const secondaryText = !!update ? t('settings.info.out-of-date') : t('settings.info.up-to-date');
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