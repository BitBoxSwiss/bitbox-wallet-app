// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { open } from '@/api/system';
import { ExternalLinkGray } from '@/components/icon';
import { getFeedbackLink } from '@/utils/url_constants';
import { SettingsItem } from '../settingsItem/settingsItem';

export const FeedbackLink = () => {
  const { t } = useTranslation();

  return (
    <SettingsItem
      icon={<ExternalLinkGray />}
      settingName={t('newSettings.about.feedbackLink.title')}
      secondaryText={t('newSettings.about.feedbackLink.description')}
      title="https://bitbox.swiss/feedback/"
      onClick={() => open(getFeedbackLink())}
    />
  );
};