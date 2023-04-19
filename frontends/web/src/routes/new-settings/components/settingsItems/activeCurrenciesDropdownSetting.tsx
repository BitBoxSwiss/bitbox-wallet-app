import Select, { ActionMeta, MultiValue, MultiValueRemoveProps, components } from 'react-select';
import { SettingsItemContainer } from '../settingsItemContainer/settingsItemContainer';
import { currencies, store, selectFiat, unselectFiat } from '../../../../components/rates/rates';
import { Fiat } from '../../../../api/account';
import styles from './defaultCurrencySetting.module.css';

type SelectOption = {
  label: Fiat;
  value: Fiat;
}

type TSelectProps = {
  options: SelectOption[]
  selectedCurrencies: SelectOption[];
}

const ReactSelect = ({ options, selectedCurrencies }: TSelectProps) => {
  const MultiValueRemove = (props: MultiValueRemoveProps<SelectOption>) => {
    return (
      selectedCurrencies.length > 1 ?
        <components.MultiValueRemove {...props}>
          {'X'}
        </components.MultiValueRemove>
        : null
    );
  };

  return (
    <Select
      className={styles.select}
      classNamePrefix="react-select"
      isSearchable
      isClearable={false}
      components={{ MultiValueRemove }}
      isMulti
      defaultValue={selectedCurrencies}
      onChange={(selectedFiats: MultiValue<SelectOption>, meta: ActionMeta<SelectOption>) => {
        switch (meta.action) {
        case 'remove-value':
          if (selectedFiats.length > 0) {
            const unselectedFiat = meta.removedValue.value;
            unselectFiat(unselectedFiat);
          }
          break;
        case 'select-option':
          const selectedFiat = selectedFiats[selectedFiats.length - 1].value as Fiat;
          selectFiat(selectedFiat);
        }
      }}
      options={options}
    />);
};

export const ActiveCurrenciesDropdownSetting = () => {
  const selectedCurrencies = store.state.selected.length > 0 ? store.state.selected.map(currency => ({ label: currency, value: currency, isFixed: true })) : [];
  const formattedCurrencies = currencies.map((currency) => ({ label: currency, value: currency }));

  return (
    <SettingsItemContainer
      settingName="Active Currencies"
      secondaryText="Which language you want the BitBoxApp to use."
      extraComponent={<ReactSelect options={formattedCurrencies} selectedCurrencies={selectedCurrencies} />}
    />
  );
};
