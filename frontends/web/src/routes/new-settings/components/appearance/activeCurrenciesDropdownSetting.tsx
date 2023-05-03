import Select, { ActionMeta, MultiValue, MultiValueRemoveProps, components } from 'react-select';
import { currencies, store, selectFiat, unselectFiat, SharedProps } from '../../../../components/rates/rates';
import { SettingsItem } from '../settingsItem/settingsItem';
import { Fiat } from '../../../../api/account';
import styles from './defaultCurrencySetting.module.css';
import { share } from '../../../../decorators/share';

type SelectOption = {
  label: Fiat;
  value: Fiat;
}

type TSelectProps = {
  options: SelectOption[];
} & SharedProps;

const ReactSelect = ({ options, active, selected }: TSelectProps) => {
  const selectedCurrencies = selected.length > 0 ? selected?.map(currency => ({ label: currency, value: currency })) : [];

  const MultiValueRemove = (props: MultiValueRemoveProps<SelectOption>) => {
    const currency = props.data.value;
    return (
      currency !== active ?
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

const ActiveCurrenciesDropdownSetting = ({ selected, active }: SharedProps) => {
  const formattedCurrencies = currencies.map((currency) => ({ label: currency, value: currency }));

  return (
    <SettingsItem
      settingName="Active Currencies"
      secondaryText="These additional currencies can be toggled through on your account page."
      extraComponent={<ReactSelect options={formattedCurrencies} active={active} selected={selected} />}
    />
  );
};

export const ActiveCurrenciesDropdownSettingWithStore = share<SharedProps>(store)(ActiveCurrenciesDropdownSetting);