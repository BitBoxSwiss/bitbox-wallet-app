// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountCode, TAccount, TAmountWithConversions } from '@/api/account';
import { Button } from '@/components/forms';
import { Logo } from '@/components/icon/logo';
import { USBSuccess } from '@/components/icon';
import { Badge } from '@/components/badge/badge';
import { InsuredShield } from '@/routes/account/components/insuredtag';
import { getAccountsByKeystore } from '@/routes/account/utils';
import { Dropdown, TOption as TDropdownOption, TGroupedOption as TDropdownGroupedOption } from '@/components/dropdown/dropdown';
import { createGroupedOptions, getBalancesForGroupedAccountSelector } from './services';
import { AmountWithUnit } from '../amount/amount-with-unit';
import styles from './groupedaccountselector.module.css';

type TGroupAccountSelector = {
  connected: boolean;
};

type TOptionAccountSelector = {
  disabled: boolean;
  coinCode?: TAccount['coinCode'];
  balance?: TAmountWithConversions;
  insured?: boolean;
};

export type TOption = TDropdownOption<AccountCode> & TOptionAccountSelector;

export type TGroupedOption = TDropdownGroupedOption<AccountCode, TGroupAccountSelector, TOptionAccountSelector>;

type TAccountSelector = {
  title: string;
  disabled?: boolean;
  selected?: string;
  onChange: (value: string) => void;
  onProceed: () => void;
  accounts: TAccount[];
};

export const GroupedAccountSelector = ({ title, disabled, selected, onChange, onProceed, accounts }: TAccountSelector) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<TGroupedOption[]>();
  const [isOpen, setIsOpen] = useState(false);

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

  const selectedOption = selected === ''
    ? { label: t('buy.info.selectLabel'), value: 'choose' as AccountCode, disabled: true }
    : options.flatMap(o => o.options).find(opt => opt.value === selected);

  const renderOption = (option: TDropdownOption<AccountCode>) => {
    const opt = option as TOption;
    const { label, coinCode, balance, insured } = opt;
    return (
      <div className={styles.valueContainer}>
        {coinCode ? <Logo coinCode={coinCode} alt={coinCode} /> : null}
        <span className={styles.selectLabelText}>{label}</span>
        {insured && <InsuredShield />}
        {coinCode && balance && (
          <span className={styles.balance}>
            <AmountWithUnit amount={balance} />
          </span>
        )}
      </div>
    );
  };

  const renderGroupHeader = (group: TGroupedOption) => (
    <div className={styles.groupHeader}>
      <span className={styles.groupLabel}>{group.label}</span>
      {group.connected && (
        <Badge
          icon={props => <USBSuccess {...props} />}
          type="success"
        />
      )}
    </div>
  );

  const mobileTriggerComponent = ({ onClick }: { onClick: () => void }) => {
    const opt = selectedOption as TOption;
    return (
      <button
        type="button"
        className={styles.mobileTrigger}
        onClick={onClick}
      >
        {opt && opt.coinCode ? (
          <div className={styles.triggerContent}>
            <Logo coinCode={opt.coinCode} alt={opt.coinCode} />
            <span className={styles.triggerLabel}>{opt.label}</span>
            {opt.insured && <InsuredShield />}
            {opt.coinCode && opt.balance && (
              <span className={styles.triggerBalance}>
                <AmountWithUnit amount={opt.balance} />
              </span>
            )}
          </div>
        ) : (
          <span className={styles.placeholderText}>
            {t('buy.info.selectLabel')}
          </span>
        )}
        <div className={styles.dropdownIcon} />
      </button>
    );
  };

  return (
    <>
      <h1 className="title text-center">{title}</h1>
      <Dropdown<AccountCode, false, TGroupAccountSelector, TOptionAccountSelector>
        className={styles.select}
        classNamePrefix="react-select"
        options={options}
        isSearchable={false}
        value={selectedOption}
        onChange={(e) => {
          const value = e?.value || '';
          onChange(value);
        }}
        renderOptions={renderOption}
        renderGroupHeader={renderGroupHeader}
        mobileFullScreen
        title={title}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        mobileTriggerComponent={mobileTriggerComponent}
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