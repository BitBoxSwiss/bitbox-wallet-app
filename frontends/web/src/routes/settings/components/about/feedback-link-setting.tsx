// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { open } from '@/api/system';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { getFeedbackLink } from '@/utils/url_constants';

export const FeedbackLink = () => {
  const { t } = useTranslation();

  return (
    <SettingsItem
      settingName={t('newSettings.about.feedbackLink.title')}
      secondaryText={t('newSettings.about.feedbackLink.description')}
      displayedValue={'bitbox.swiss/feedback'}
      onClick={() => open(getFeedbackLink())}
    />
  );
};