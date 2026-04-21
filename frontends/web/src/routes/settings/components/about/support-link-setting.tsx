// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { open } from '@/api/system';
import { ExternalLinkGray } from '@/components/icon';
import { getSupportLink } from '@/utils/url_constants';
import { SettingsItem } from '../settingsItem/settingsItem';

export const SupportLink = () => {
  const { t } = useTranslation();

  return (
    <SettingsItem
      icon={<ExternalLinkGray />}
      settingName={t('newSettings.about.supportLink.title')}
      secondaryText={t('newSettings.about.supportLink.description')}
      title="https://support.bitbox.swiss/"
      onClick={() => open(getSupportLink())}
    />
  );
};