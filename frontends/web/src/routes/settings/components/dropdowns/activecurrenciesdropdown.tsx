import { useEffect, useState } from 'react';
import Select, { ActionMeta, DropdownIndicatorProps, OptionProps, components } from 'react-select';
import { selectFiat, unselectFiat, SharedProps } from '../../../../components/rates/rates';
import { Fiat } from '../../../../api/account';
import { SelectedCheckLight } from '../../../../components/icon';
import dropdownStyles from './dropdowns.module.css';
import activeCurrenciesDropdownStyle from './activecurrenciesdropdown.module.css';
import { useTranslation } from 'react-i18next';

type SelectOption = {
    label: String;
    value: Fiat;
  }

type TSelectProps = {
    options: SelectOption[];
  } & SharedProps;

// a multi-select dropdown
export const ActiveCurrenciesDropdown = ({
  options,
  active: defaultCurrency, // active here actually means default, thus aliasing it
  selected
}: TSelectProps) => {
  const [selectedCurrencies, setSelectedCurrencies] = useState<SelectOption[]>([]);
  const [search, setSearch] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (selected.length > 0) {
      const formattedSelectedCurrencies = selected.map(currency => ({ label: currency, value: currency }));
      setSelectedCurrencies(formattedSelectedCurrencies);
    }
  }, [selected]);

  const DropdownIndicator = (props: DropdownIndicatorProps<SelectOption, true>) => {
    return (
      <components.DropdownIndicator {...props}>
        <div className={dropdownStyles.dropdown} />
      </components.DropdownIndicator>
    );
  };

  const Option = (props: OptionProps<SelectOption, true>) => {
    const { label, value } = props.data;
    const selected = selectedCurrencies.findIndex(currency => currency.value === value) >= 0;
    const isDefaultCurrency = defaultCurrency === value;
    return (
      <components.Option {...props} className={`${isDefaultCurrency ? activeCurrenciesDropdownStyle.defaultCurrency : ''}`}>
        <span>{label}</span>
        {isDefaultCurrency ? <p className={activeCurrenciesDropdownStyle.defaultLabel}>{t('fiat.default')}</p> : null}
        {selected && !isDefaultCurrency ? <SelectedCheckLight /> : null}
      </components.Option>
    );
  };
  return (
    <Select
      className={`
         ${dropdownStyles.select}
         ${activeCurrenciesDropdownStyle.select}
         ${search.length > 0 ? activeCurrenciesDropdownStyle.hideMultiSelect : ''}
         `}
      classNamePrefix="react-select"
      isSearchable
      isClearable={false}
      components={{ DropdownIndicator, IndicatorSeparator: () => null, MultiValueRemove: () => null, Option }}
      isMulti
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      value={[...selectedCurrencies].reverse()}
      onInputChange={(newValue) => setSearch(newValue)}
      onChange={(_, meta: ActionMeta<SelectOption>) => {
        switch (meta.action) {
        case 'select-option':
          if (meta.option) {
            selectFiat(meta.option.value);
          }
          break;
        case 'deselect-option':
          if (meta.option && meta.option.value !== defaultCurrency) {
            unselectFiat(meta.option.value);
          }
        }

      }}
      options={options}
    />);
};
