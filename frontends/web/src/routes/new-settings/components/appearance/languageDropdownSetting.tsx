import { SettingsItem } from '../settingsItem/settingsItem';
import { useTranslation } from 'react-i18next';
import { TLanguagesList } from '../../../../components/language/types';
import { getSelectedIndex } from '../../../../utils/language';
import { SingleDropdown } from '../singledropdown/singledropdown';

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
  const { i18n } = useTranslation();
  const selectedLanguage = defaultLanguages[getSelectedIndex(defaultLanguages, i18n)];
  const formattedLanguages = defaultLanguages.map(lang => ({ label: lang.display, value: lang.code }));
  return (
    <SettingsItem
      settingName="Language"
      secondaryText="Which language you want the BitBoxApp to use."
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
