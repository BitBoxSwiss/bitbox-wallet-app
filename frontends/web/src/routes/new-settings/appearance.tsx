import { DarkmodeToggleSetting } from './components/appearance/darkmodeToggleSetting';
import { DefaultCurrencyDropdownSetting } from './components/appearance/defaultCurrencyDropdownSetting';
import { DisplaySatsToggleSetting } from './components/appearance/displaySatsToggleSetting';
import { LanguageDropdownSetting } from './components/appearance/languageDropdownSetting';
import { ActiveCurrenciesDropdownSetting } from './components/appearance/activeCurrenciesDropdownSetting';
import useSettingsTab from './components/hooks/useSettingsTab';

const ApperanceWithoutTabs = () => {
  return (
    <>
      <DefaultCurrencyDropdownSetting />
      <ActiveCurrenciesDropdownSetting />
      <LanguageDropdownSetting />
      <DarkmodeToggleSetting />
      <DisplaySatsToggleSetting />
    </>
  );
};

export const Appearance = () => {
  const WithTabs = useSettingsTab(ApperanceWithoutTabs);
  return (
    <WithTabs />
  );
};
