import { useTranslation } from 'react-i18next';
import { useDarkmode } from '../../../../hooks/darkmode';
import { Toggle } from '../../../../components/toggle/toggle';
import { SettingsItemContainer } from '../settingsItemContainer/settingsItemContainer';

export const DarkmodeToggleSetting = () => {
  const { t } = useTranslation();
  const { toggleDarkmode, isDarkMode } = useDarkmode();
  return (
    <SettingsItemContainer
      settingName={t('darkmode.toggle')}
      secondaryText="See the BitBoxApp in dark mode."
      extraComponent={<Toggle checked={isDarkMode} onChange={() => toggleDarkmode(!isDarkMode)} />}
    />
  );
};
