import { SettingsItemContainer } from '../settingsItemContainer/settingsItemContainer';
import Select from 'react-select';
import { store, setActiveFiat } from '../../../../components/rates/rates';
import { Fiat } from '../../../../api/account';
import styles from './defaultCurrencySetting.module.css';

type SelectOption = {
  label: Fiat;
  value: Fiat;
}

type TSelectProps = {
  options: SelectOption[];
  handleChange: (fiat: Fiat) => void;
}

const ReactSelect = ({ options, handleChange }: TSelectProps) => <Select
  className={styles.select}
  classNamePrefix="react-select"
  defaultValue={{ label: store.state.active, value: store.state.active }}
  isSearchable={true}
  onChange={(selected) => {
    if (selected) {
      handleChange(selected.value as Fiat);
    }
  }
  }
  options={options}
/>;

export const DefaultCurrencyDropdownSetting = () => {
  const formattedCurrencies = store.state.selected.map((currency) => ({ label: currency, value: currency }));

  return (
    <SettingsItemContainer
      settingName="Default Currency"
      secondaryText="Select your default currency."
      extraComponent={<ReactSelect options={formattedCurrencies} handleChange={setActiveFiat}/>}
    />
  );
};