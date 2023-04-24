import { useTranslation } from 'react-i18next';
import { useDarkmode } from '../../../../hooks/darkmode';
import { Toggle } from '../../../../components/toggle/toggle';
import { SettingsItem } from '../settingsItem/settingsItem';

export const DarkmodeToggleSetting = () => {
  const { t } = useTranslation();
  const { toggleDarkmode, isDarkMode } = useDarkmode();
  return (
    <SettingsItem
      settingName={t('darkmode.toggle')}
      secondaryText="See the BitBoxApp in dark mode."
      extraComponent={<Toggle checked={isDarkMode} onChange={() => toggleDarkmode(!isDarkMode)} />}
    />
  );
};
