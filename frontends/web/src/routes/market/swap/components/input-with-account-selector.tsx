// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useState, type ChangeEvent } from 'react';
import type { AccountCode, TAccountBase } from '@/api/account';
import { convertToCurrency } from '@/api/coins';
import { RatesContext } from '@/contexts/RatesContext';
import { NumberInput } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { Amount } from '@/components/amount/amount';
import { AmountUnit } from '@/components/amount/amount-with-unit';
import { findAccount } from '@/routes/account/utils';
import style from './input-with-account-selector.module.css';

type Props<T extends TAccountBase> = {
  accountCode: AccountCode | undefined;
  accounts: T[];
  disabledAccountCodes?: AccountCode[];
  id: string;
  testId?: string;
  onChangeAccountCode: (accountCode: AccountCode) => void;
  onChangeValue?: (value: string) => void;
  value: string | undefined;
};

export const InputWithAccountSelector = <T extends TAccountBase, >({
  accountCode,
  accounts,
  disabledAccountCodes = [],
  id,
  testId,
  onChangeAccountCode,
  onChangeValue,
  value,
}: Props<T>) => {
  const { defaultCurrency } = useContext(RatesContext);
  const [selectedAccount, setSelectedAccount] = useState<T>();
  const hasAccounts = accounts && accounts.length > 0;

  const [esitmatedFiatValue, setEstimatedFiatValue] = useState<string | null>();

  useEffect(() => {
    setSelectedAccount(accountCode ? findAccount(accounts, accountCode) : undefined);
  }, [accountCode, accounts]);

  // update estimated fiat amount
  useEffect(() => {
    if (selectedAccount && value) {
      convertToCurrency({
        amount: value,
        coinCode: selectedAccount.coinCode,
        fiatUnit: defaultCurrency,
      })
        .then(response => {
          if (response.success) {
            setEstimatedFiatValue(response.fiatAmount);
          }
        });
    } else {
      setEstimatedFiatValue(null);
    }
  }, [defaultCurrency, selectedAccount, value]);

  return (
    <div className={style.accountWithInputContainer} data-testid={testId}>
      <div className={style.accountSelectorCol}>
        {hasAccounts && (
          <GroupedAccountSelector
            accounts={accounts}
            disabledAccountCodes={disabledAccountCodes}
            selected={accountCode}
            onChange={(accountCode => {
              const account = findAccount(accounts, accountCode);
              setSelectedAccount(account);
              onChangeAccountCode(accountCode);
            })}
            stackedLayout
            className={style.accountSelectorDropdown}
          />
        )}
      </div>
      <label className={style.inputCol}>
        <div className={style.inputWithUnit}>
          <NumberInput
            transparent
            align="right"
            disabled={!selectedAccount}
            id={id}
            className={style.inputComponent}
            classNameInputField={style.inputField}
            name={id}
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChangeValue && onChangeValue(event.target.value);
            }}
          />
          <span className={style.inputUnit}>
            {selectedAccount?.coinUnit}
          </span>
        </div>
        <div className={style.fiat}>
          {esitmatedFiatValue ? (
            <>
              <Amount amount={esitmatedFiatValue} unit={defaultCurrency} />
              <AmountUnit unit={defaultCurrency} />
            </>
          ) : null}
        </div>
      </label>
    </div>
  );
};
