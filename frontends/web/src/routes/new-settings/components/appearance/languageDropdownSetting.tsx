import { SettingsItemContainer } from '../settingsItemContainer/settingsItemContainer';
import { useTranslation } from 'react-i18next';
import { TActiveLanguageCodes, TLanguage, TLanguagesList } from '../../../../components/language/types';
import Select from 'react-select';
import styles from './defaultCurrencySetting.module.css';
import { getSelectedIndex } from '../../../../utils/language';

type SelectOption = {
  label: string;
  value: TActiveLanguageCodes;
}

type TSelectProps = {
  options: SelectOption[];
  handleChange: (langCode: TActiveLanguageCodes) => void;
  selectedLanguage: TLanguage;
}

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


const ReactSelect = ({ options, handleChange, selectedLanguage }: TSelectProps) => <Select
  className={styles.select}
  classNamePrefix="react-select"
  isSearchable={true}
  defaultValue={{ label: selectedLanguage.display, value: selectedLanguage.code }}
  onChange={(selected) => {
    if (selected) {
      handleChange(selected.value as TActiveLanguageCodes);
    }
  }
  }
  options={options}
/>;

export const LanguageDropdownSetting = () => {
  const { i18n } = useTranslation();
  const selectedLanguage = defaultLanguages[getSelectedIndex(defaultLanguages, i18n)];
  const formattedLanguages = defaultLanguages.map(lang => ({ label: lang.display, value: lang.code }));
  return (
    <SettingsItemContainer
      settingName="Language"
      secondaryText="Which language you want the BitBoxApp to use."
      extraComponent={<ReactSelect options={formattedLanguages} handleChange={i18n.changeLanguage} selectedLanguage={selectedLanguage} />}
    />
  );
};
