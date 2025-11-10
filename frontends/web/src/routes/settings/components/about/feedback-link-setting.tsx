/**
 * Copyright 2025 Shift Crypto AG
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