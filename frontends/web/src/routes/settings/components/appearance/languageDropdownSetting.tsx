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

import { SettingsItem } from '../settingsItem/settingsItem';
import { useTranslation } from 'react-i18next';
import { TLanguagesList } from '../../../../components/language/types';
import { getSelectedIndex } from '../../../../utils/language';
import { SingleDropdown } from '../dropdowns/singledropdown';

const defaultLanguages: TLanguagesList = [
  { code: 'ar', display: 'العربية' },
  { code: 'bg', display: 'България' },
  { code: 'de', display: 'Deutsch' },
  { code: 'en', display: 'English' },
  { code: 'es', display: 'Español' },
  { code: 'fa', display: 'فارسی' },
  { code: 'fr', display: 'Français' },
  { code: 'he', display: 'עברית' },
  { code: 'hi', display: 'हिन्दी ' },
  { code: 'it', display: 'Italiano' },
  { code: 'ja', display: '日本語' },
  { code: 'ms', display: 'Bahasa Melayu' },
  { code: 'nl', display: 'Nederlands' },
  { code: 'pt', display: 'Português' },
  { code: 'ru', display: 'Русский' },
  { code: 'sl', display: 'Slovenščina' },
  { code: 'tr', display: 'Türkçe' },
  { code: 'zh', display: '中文' },
];

export const LanguageDropdownSetting = () => {
  const { i18n, t } = useTranslation();
  const selectedLanguage = defaultLanguages[getSelectedIndex(defaultLanguages, i18n)];
  const formattedLanguages = defaultLanguages.map(lang => ({ label: lang.display, value: lang.code }));
  return (
    <SettingsItem
      settingName={t('newSettings.appearance.language.title')}
      secondaryText={t('newSettings.appearance.language.description')}
      collapseOnSmall
      extraComponent={
        <SingleDropdown
          options={formattedLanguages}
          handleChange={i18n.changeLanguage}
          defaultValue={{ label: selectedLanguage.display, value: selectedLanguage.code }}
        />
      }
    />
  );
};