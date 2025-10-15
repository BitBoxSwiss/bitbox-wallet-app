/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Select, { components, SingleValueProps, OptionProps, SingleValue, DropdownIndicatorProps, GroupProps, GroupHeadingProps as ReactSelectGroupHeadingProps } from 'react-select';
import { AccountCode, TAccount } from '@/api/account';
import { Button } from '@/components/forms';
import { Logo } from '@/components/icon/logo';
import { AppContext } from '@/contexts/AppContext';
import { USBSuccess } from '@/components/icon';
import { Badge } from '@/components/badge/badge';
import { InsuredShield } from '@/routes/account/components/insuredtag';
import { getAccountsByKeystore } from '@/routes/account/utils';
import { createGroupedOptions, getBalancesForGroupedAccountSelector } from './services';
import styles from './groupedaccountselector.module.css';

export type TGroupedOption = {
  label: string;
  connected: boolean;
  options: TOption[];
};

export type TOption = {
  label: string;
  value: AccountCode;
  disabled: boolean;
  coinCode?: TAccount['coinCode'];
  balance?: string;
  insured?: boolean;
};

type TAccountSelector = {
  title: string;
  disabled?: boolean;
  selected?: string;
  onChange: (value: string) => void;
  onProceed: () => void;
  accounts: TAccount[];
};

const SelectSingleValue = (props: SingleValueProps<TOption>) => {
  const { hideAmounts } = useContext(AppContext);
  const { label, coinCode, balance, insured } = props.data;
  return (
    <div className={styles.singleValueContainer}>
      <components.SingleValue {...props}>
        <div className={styles.valueContainer}>
          {coinCode ? <Logo coinCode={coinCode} alt={coinCode} /> : null}
          <span className={styles.selectLabelText}>{label}</span>
          {insured && <InsuredShield/>}
          {coinCode && balance && <span className={styles.balanceSingleValue}>{hideAmounts ? `*** ${coinCode}` : balance}</span>}
        </div>
      </components.SingleValue>
    </div>
  );
};

const SelectOption = (props: OptionProps<TOption>) => {
  const { hideAmounts } = useContext(AppContext);
  const { label, coinCode, balance, insured } = props.data;

  return (
    <components.Option {...props}>
      <div className={styles.valueContainer}>
        {coinCode ? <Logo coinCode={coinCode} alt={coinCode} /> : null}
        <span className={styles.selectLabelText}>{label}</span>
        {insured && <InsuredShield/>}
        {coinCode && balance && <span className={styles.balance}>{hideAmounts ? `*** ${coinCode}` : balance}</span>}
      </div>
    </components.Option>
  );
};

const DropdownIndicator = (props: DropdownIndicatorProps<TOption>) => {
  return (
    <components.DropdownIndicator {...props}>
      <div className={styles.dropdown} />
    </components.DropdownIndicator>
  );
};

const Group = (props: GroupProps<TOption>) => (
  <div>
    <components.Group {...props} />
  </div>
);

type GroupHeadingProps = {
  customData: TGroupedOption
} & ReactSelectGroupHeadingProps<TOption>;

const GroupHeading = (
  { customData, ...props }: GroupHeadingProps
) => {
  return (
    <div className={styles.groupHeader}>
      <components.GroupHeading {...props} data={customData} />
      {customData.connected && (
        <Badge
          icon={props => <USBSuccess {...props} />}
          type="success"
        />
      )}
    </div>
  );
};

export const GroupedAccountSelector = ({ title, disabled, selected, onChange, onProceed, accounts }: TAccountSelector) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<TGroupedOption[]>();

  useEffect(() => {
    //setting options without balance
    const accountsByKeystore = getAccountsByKeystore(accounts);
    const groupedOpts: TGroupedOption[] = createGroupedOptions(accountsByKeystore);
    setOptions(groupedOpts);
    //asynchronously fetching each account's balance
    getBalancesForGroupedAccountSelector(groupedOpts).then(setOptions);
  }, [accounts]);

  if (!options) {
    return null;
  }

  return (
    <>
      <h1 className="title text-center">{title}</h1>
      <Select
        className={styles.select}
        classNamePrefix="react-select"
        options={options}
        isSearchable={false}
        value={selected === '' ? {
          label: t('buy.info.selectLabel'),
          value: 'choose',
          disabled: true
        } : options.flatMap(o => o.options).find(opt => opt.value === selected)}
        onChange={(e) => {
          const value = (e as SingleValue<TOption>)?.value || '';
          onChange(value);
        }}
        components={{
          Group,
          GroupHeading: (props) => <GroupHeading customData={props.data as TGroupedOption} {...props} />,
          DropdownIndicator,
          Option: SelectOption,
          SingleValue: SelectSingleValue,
          IndicatorSeparator: () => null
        }}
        defaultValue={options[0]?.options[0]}
      />
      <div className="buttons text-center">
        <Button
          primary
          onClick={onProceed}
          disabled={!selected || disabled}>
          {t('buy.info.next')}
        </Button>
      </div>
    </>

  );
};