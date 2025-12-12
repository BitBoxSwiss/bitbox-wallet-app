// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { open } from '@/api/system';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { getSupportLink } from '@/utils/url_constants';

export const SupportLink = () => {
  const { t } = useTranslation();

  return (
    <SettingsItem
      settingName={t('newSettings.about.supportLink.title')}
      secondaryText={t('newSettings.about.supportLink.description')}
      displayedValue={'support.bitbox.swiss'}
      onClick={() => open(getSupportLink())}
    />
  );
};