/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { useLoad } from '@/hooks/api';
import { useMediaQuery } from '@/hooks/mediaquery';
import { getNativeLocale } from '@/api/nativelocale';
import { defaultLanguages, TLanguage } from '@/components/language/types';
import { Dropdown } from '@/components/dropdown/dropdown';
import { getSelectedIndex } from '@/utils/language';
import { GlobeDark, GlobeLight } from '@/components/icon/icon';
import { useDarkmode } from '@/hooks/darkmode';
import settingsDropdownStyles from './settingsdropdown.module.css';
import styles from './languageDropDownSetting.module.css';

export const LanguageDropdownSetting = () => {
  const { i18n, t } = useTranslation();
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);
  const nativeLocale = useLoad(getNativeLocale);
  const selectedLanguage = defaultLanguages[getSelectedIndex(defaultLanguages, i18n)] as TLanguage;
  const formattedLanguages = defaultLanguages.map(lang => ({ label: lang.display, value: lang.code }));
  const { isDarkMode } = useDarkmode();
  const globe = isDarkMode ? <GlobeLight /> : <GlobeDark />;
  const isMobile = useMediaQuery('(max-width: 768px)');
  return (
    <SettingsItem
      disabled={!isMobile}
      onClick={!isMobileSelectorOpen ? () => setIsMobileSelectorOpen(true) : undefined}
      settingName={<div className={styles.container}>{globe}{t('newSettings.appearance.language.title')}</div>}
      secondaryText={t('newSettings.appearance.language.description')}
      collapseOnSmall
      title={nativeLocale && `Detected native locale: ${nativeLocale}`}
      extraComponent={
        <Dropdown
          isOpen={isMobileSelectorOpen}
          onOpenChange={(isOpen) => setIsMobileSelectorOpen(isOpen)}
          mobileFullScreen
          className={settingsDropdownStyles.select}
          renderOptions={(o) => (o.label)}
          options={formattedLanguages}
          title={t('newSettings.appearance.language.title')}
          onChange={(selected) => i18n.changeLanguage(selected.value)}
          value={{ label: selectedLanguage.display, value: selectedLanguage.code }}
        />
      }
    />
  );
};