// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useState } from 'react';
import { ActionMeta } from 'react-select';
import { Fiat } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { SelectedCheckLight } from '@/components/icon';
import { Dropdown } from '@/components/dropdown/dropdown';
import { useTranslation } from 'react-i18next';
import activeCurrenciesDropdownStyle from './activecurrenciesdropdown.module.css';
import settingsDropdownStyles from './settingsdropdown.module.css';

type SelectOption = {
  label: string;
  value: Fiat;
};

type TSelectProps = {
  options: SelectOption[];
  defaultCurrency: Fiat;
  activeCurrencies: Fiat[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const sortCurrencyOptions = (options: SelectOption[], activeCurrencies: Fiat[]): SelectOption[] => {
  const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label);
  const selected = options.filter(opt => activeCurrencies.includes(opt.value)).sort(byLabel);
  const others = options.filter(opt => !activeCurrencies.includes(opt.value)).sort(byLabel);
  return [...selected, ...others];
};

export const ActiveCurrenciesDropdown = ({
  options,
  defaultCurrency,
  activeCurrencies,
  isOpen,
  onOpenChange
}: TSelectProps) => {
  const [formattedActiveCurrencies, setFormattedActiveCurrencies] = useState<SelectOption[]>([]);
  const { t } = useTranslation();

  const { removeFromActiveCurrencies, addToActiveCurrencies } = useContext(RatesContext);

  useEffect(() => {
    if (activeCurrencies.length > 0) {
      const formattedSelectedCurrencies = activeCurrencies.map(currency => ({ label: currency, value: currency }));
      setFormattedActiveCurrencies(formattedSelectedCurrencies);
    }
  }, [activeCurrencies]);

  const Options = ({ props }: { props: SelectOption }) => {
    const { label, value } = props;
    const selected = formattedActiveCurrencies.findIndex(currency => currency.value === value) >= 0;
    const isDefaultCurrency = defaultCurrency === value;
    return (
      <div className={`
        ${activeCurrenciesDropdownStyle.optionContainer || ''}
        ${isDefaultCurrency && activeCurrenciesDropdownStyle.defaultCurrency || ''}
      `}>
        <span>{label}</span>
        {isDefaultCurrency ? <p className={activeCurrenciesDropdownStyle.defaultLabel}>{t('fiat.default')}</p> : null}
        {selected && !isDefaultCurrency ? <SelectedCheckLight /> : null}
      </div>
    );
  };
  const sortedOptions = sortCurrencyOptions(options, activeCurrencies);

  return (
    <Dropdown
      isMulti
      closeMenuOnSelect={false}
      options={sortedOptions}
      value={formattedActiveCurrencies}
      title={t('newSettings.appearance.activeCurrencies.title')}
      mobileFullScreen
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onChange={async (_, meta: ActionMeta<SelectOption>) => {
        switch (meta.action) {
        case 'select-option':
          if (meta.option) {
            await addToActiveCurrencies(meta.option.value);
          }
          break;
        case 'deselect-option':
          if (meta.option && meta.option.value !== defaultCurrency) {
            await removeFromActiveCurrencies(meta.option.value);
          }
        }
      }}
      isSearchable
      className={settingsDropdownStyles.select}
      renderOptions={(o) => <Options props={o} />}
      classNamePrefix="react-select"
    />
  );
};
