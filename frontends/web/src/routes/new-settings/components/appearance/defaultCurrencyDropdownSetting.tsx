import { setActiveFiat, store } from '../../../../components/rates/rates';
import { SingleDropdown } from '../singledropdown/singledropdown';
import { SettingsItem } from '../settingsItem/settingsItem';

export const DefaultCurrencyDropdownSetting = () => {
  const formattedCurrencies = store.state.selected.map((currency) => ({ label: currency, value: currency }));

  return (
    <SettingsItem
      settingName="Default Currency"
      secondaryText="Select your default currency."
      extraComponent={
        <SingleDropdown
          options={formattedCurrencies}
          handleChange={setActiveFiat}
          defaultValue={{ label: store.state.active, value: store.state.active }}
        />
      }
    />
  );
};