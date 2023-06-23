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
import { defaultLanguages } from '../../../../components/language/types';
import { getSelectedIndex } from '../../../../utils/language';
import { SingleDropdown } from '../dropdowns/singledropdown';

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