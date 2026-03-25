// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount, TAmountWithConversions } from '@/api/account';
import { Button } from '@/components/forms';
import { Logo } from '@/components/icon/logo';
import { USBSuccess, ChevronDownDark } from '@/components/icon';
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
  coinUnit?: TAccount['coinUnit'];
  balance?: TAmountWithConversions;
  insured?: boolean;
};

export type TOption = TDropdownOption<AccountCode> & TOptionAccountSelector;

export type TGroupedOption = TDropdownGroupedOption<AccountCode, TGroupAccountSelector, TOptionAccountSelector>;

const mergeOptionsWithBalances = (
  targetOptions: TGroupedOption[],
  sourceOptions?: TGroupedOption[],
) => {
  if (!sourceOptions) {
    return targetOptions;
  }
  const balanceByAccountCode = new Map(
    sourceOptions
      .flatMap(group => group.options)
      .map(option => [option.value, option.balance] as const)
      .filter((entry): entry is readonly [AccountCode, TAmountWithConversions] => Boolean(entry[1]))
  );

  return targetOptions.map(group => ({
    ...group,
    options: group.options.map(option => ({
      ...option,
      balance: balanceByAccountCode.get(option.value),
    })),
  }));
};

type TTriggerContentProps = {
  option: TOption | undefined;
  stackedLayout?: boolean;
};

const TriggerContent = ({
  option,
  stackedLayout = false,
}: TTriggerContentProps) => {
  const { t } = useTranslation();
  return (
    option && option.coinCode ? (
      <div className={styles.triggerContent}>
        <Logo coinCode={option.coinCode} alt={option.coinCode} />
        <span className={styles.triggerLabel}>
          {stackedLayout ? option.balance?.unit || option.coinUnit : option.label}
        </span>
        {option.insured && <InsuredShield />}
        {stackedLayout ? (
          <span className={styles.triggerAccountName}>
            {option.label}
          </span>
        ) : (
          option.coinCode && option.balance && (
            <span className={styles.triggerBalance}>
              <AmountWithUnit amount={option.balance} />
            </span>
          )
        )}
      </div>
    ) : (
      <span className={styles.placeholderText}>
        {t('buy.info.selectLabel')}
      </span>
    )
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

type TAccountSelector = {
  title?: string;
  disabled?: boolean;
  disabledAccountCodes?: AccountCode[];
  loadBalances?: boolean;
  selected?: string;
  onChange: (value: string) => void;
  onProceed?: () => void;
  accounts: TAccount[];
  stackedLayout?: boolean;
  className?: string;
};

export const GroupedAccountSelector = ({
  title,
  disabled,
  disabledAccountCodes = [],
  loadBalances = true,
  selected,
  onChange,
  onProceed,
  accounts,
  stackedLayout,
  className = '',
}: TAccountSelector) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<TGroupedOption[]>();
  const [isOpen, setIsOpen] = useState(false);
  const disabledAccountCodesKey = disabledAccountCodes.join(',');
  const disabledAccountCodesRef = useRef(disabledAccountCodes);
  disabledAccountCodesRef.current = disabledAccountCodes;

  useEffect(() => {
    //setting options without balance
    const accountsByKeystore = getAccountsByKeystore(accounts);
    const groupedOpts: TGroupedOption[] = createGroupedOptions(accountsByKeystore, disabledAccountCodesRef.current);
    setOptions(currentOptions => mergeOptionsWithBalances(groupedOpts, currentOptions));
  }, [accounts, disabledAccountCodesKey]);

  useEffect(() => {
    if (!loadBalances) {
      return;
    }
    let isCancelled = false;
    const accountsByKeystore = getAccountsByKeystore(accounts);
    const groupedOpts: TGroupedOption[] = createGroupedOptions(accountsByKeystore);
    //asynchronously fetching each account's balance
    getBalancesForGroupedAccountSelector(groupedOpts).then(optionsWithBalances => {
      if (!isCancelled) {
        setOptions(currentOptions => mergeOptionsWithBalances(currentOptions || groupedOpts, optionsWithBalances));
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [accounts, loadBalances]);

  if (!options) {
    return null;
  }

  const selectedOption: TOption | undefined = (
    !selected
      ? { label: t('buy.info.selectLabel'), value: 'choose', disabled: true }
      : options.flatMap(o => o.options).find(opt => opt.value === selected)
  );

  const renderOption = (option: TOption, isSelectedValue: boolean) => {
    const isStacked = stackedLayout && isSelectedValue;
    return (
      <div className={`${styles.valueContainer || ''} ${isStacked ? styles.layoutOnTwoLines || '' : ''}`}>
        <TriggerContent option={option} stackedLayout={isStacked} />
      </div>
    );
  };

  const renderTrigger = ({ onClick }: { onClick: () => void }) => {
    return (
      <button
        type="button"
        className={`
          ${styles.trigger || ''}
          ${stackedLayout && styles.layoutOnTwoLines || ''}
        `}
        onClick={onClick}
      >
        <TriggerContent option={selectedOption} stackedLayout={stackedLayout} />
        <ChevronDownDark />
      </button>
    );
  };

  return (
    <>
      {title && (
        <h1 className="title text-center">{title}</h1>
      )}
      <Dropdown<AccountCode, false, TGroupAccountSelector, TOptionAccountSelector>
        className={`
          ${styles.select || ''}
          ${stackedLayout ? styles.stackedSelect || '' : ''}
          ${className}
        `.trim()}
        classNamePrefix="react-select"
        options={options}
        isSearchable={false}
        value={selectedOption}
        onChange={(e) => {
          const value = e?.value || '';
          onChange(value);
        }}
        isOptionDisabled={option => (option as TOption).disabled || false}
        renderOptions={renderOption}
        renderGroupHeader={renderGroupHeader}
        mobileFullScreen
        title={title}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        renderTrigger={renderTrigger}
      />
      {onProceed && (
        <div className={styles.buttons}>
          <Button
            primary
            onClick={onProceed}
            disabled={!selected || disabled}>
            {t('buy.info.next')}
          </Button>
        </div>
      )}
    </>
  );
};
