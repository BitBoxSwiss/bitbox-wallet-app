// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useDarkmode } from '@/hooks/darkmode';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export const DarkmodeToggleSetting = () => {
  const { t } = useTranslation();
  const { toggleDarkmode, isDarkMode } = useDarkmode();
  return (
    <SettingsItem
      settingName={t('darkmode.toggle')}
      secondaryText={t('newSettings.appearance.darkmode.description')}
      extraComponent={<Toggle checked={isDarkMode} onChange={() => toggleDarkmode(!isDarkMode)} />}
    />
  );
};