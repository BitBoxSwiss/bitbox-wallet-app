/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { FunctionComponent, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Select, { components, SingleValueProps, OptionProps, SingleValue, DropdownIndicatorProps } from 'react-select';
import { AccountCode, IAccount, getBalance } from '../../api/account';
import { Button } from '../forms';
import Logo from '../icon/logo';
import AppContext from '../../contexts/AppContext';
import styles from './accountselector.module.css';

export type TOption = {
  label: string;
  value: AccountCode;
  disabled: boolean;
  coinCode?: IAccount['coinCode'];
  balance?: string;
}

type TAccountSelector = {
    title: string;
    options: TOption[];
    selected?: string;
    onChange: (value: string) => void;
    onProceed: () => void;
}

export const setOptionBalances = async (options: TOption[]): Promise<TOption[]> => {
  return await Promise.all(options.map(async (option) => {
    const balance = await getBalance(option.value);
    return { ...option, balance: `${balance.available.amount} ${balance.available.unit}` };
  }));
};

const SelectSingleValue: FunctionComponent<SingleValueProps<TOption>> = (props) => {
  const { hideAmounts } = useContext(AppContext);
  const { label, coinCode, balance } = props.data;
  return (
    <div className={styles.singleValueContainer}>
      <components.SingleValue {...props}>
        <div className={styles.valueContainer}>
          {coinCode ? <Logo coinCode={coinCode} alt={coinCode} /> : null}
          <span className={styles.selectLabelText}>{label}</span>
          {coinCode && balance && <span className={styles.balanceSingleValue}>{hideAmounts ? `*** ${coinCode}` : balance}</span>}
        </div>
      </components.SingleValue>
    </div>
  );
};

const SelectOption: FunctionComponent<OptionProps<TOption>> = (props) => {
  const { hideAmounts } = useContext(AppContext);
  const { label, coinCode, balance } = props.data;

  return (
    <components.Option {...props}>
      <div className={styles.valueContainer}>
        {coinCode ? <Logo coinCode={coinCode} alt={coinCode} /> : null}
        <span className={styles.selectLabelText}>{label}</span>
        {coinCode && balance && <span className={styles.balance}>{hideAmounts ? `*** ${coinCode}` : balance}</span>}
      </div>
    </components.Option>
  );
};

const DropdownIndicator: FunctionComponent<DropdownIndicatorProps<TOption>> = (props) => {
  return (
    <components.DropdownIndicator {...props}>
      <div className={styles.dropdown} />
    </components.DropdownIndicator>
  );
};



export const AccountSelector = ({ title, options, selected, onChange, onProceed }: TAccountSelector) => {
  const { t } = useTranslation();
  const [selectedAccount, setSelectedAccount] = useState<TOption>();

  useEffect(() => {
    setSelectedAccount(options.find(opt => opt.value === selected));
  }, [options, selected]);

  return (
    <>
      <h1 className="title text-center">{title}</h1>
      <Select
        className={styles.select}
        classNamePrefix="react-select"
        components={{ DropdownIndicator, SingleValue: SelectSingleValue, Option: SelectOption, IndicatorSeparator: () => null }}
        value={selected === '' ? {
          label: t('buy.info.selectLabel'),
          value: 'choose',
          disabled: true
        } : selectedAccount}
        isSearchable={false}
        onChange={(e) => {
          const value = (e as SingleValue<TOption>)?.value || '';
          onChange(value);
        }}
        isOptionDisabled={(option) => option.disabled}
        options={[{
          label: t('buy.info.selectLabel') || '',
          value: 'choose',
          disabled: true
        },
        ...options
        ]}
      />
      <div className="buttons text-center">
        <Button
          primary
          onClick={onProceed}
          disabled={!selected}>
          {t('buy.info.next')}
        </Button>
      </div>
    </>

  );
};
