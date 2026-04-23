// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { AccountCode, TAccountBase } from '@/api/account';
import { convertToCurrency } from '@/api/coins';
import { RatesContext } from '@/contexts/RatesContext';
import { NumberInput } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { Amount } from '@/components/amount/amount';
import { AmountUnit } from '@/components/amount/amount-with-unit';
import { findAccount, getDisplayedCoinUnit } from '@/routes/account/utils';
import style from './input-with-account-selector.module.css';
import { useMountedRef } from '@/hooks/mount';

type Props<T extends TAccountBase> = {
  accountCode: AccountCode;
  accounts: T[];
  id: string;
  isAccountDisabled?: (account: T) => boolean;
  onChangeAccountCode: (accountCode: AccountCode) => void;
  onChangeValue?: (value: string) => void;
  readOnlyAmount?: boolean;
  value: string | undefined;
};

export const InputWithAccountSelector = <T extends TAccountBase, >({
  accountCode,
  accounts,
  id,
  isAccountDisabled,
  onChangeAccountCode,
  onChangeValue,
  value,
  readOnlyAmount = false,
}: Props<T>) => {
  const { btcUnit, defaultCurrency } = useContext(RatesContext);
  const [selectedAccount, setSelectedAccount] = useState<T>();
  const hasAccounts = accounts && accounts.length > 0;

  const [esitmatedFiatValue, setEstimatedFiatValue] = useState<string | null>();

  useEffect(() => {
    if (accountCode) {
      const account = findAccount(accounts, accountCode);
      setSelectedAccount(account);
    }
  }, [accountCode, accounts]);

  const isMounted = useMountedRef();
  const requestIdRef = useRef(0);

  // update estimated fiat amount
  useEffect(() => {
    if (selectedAccount && value && value !== '') {
      const requestId = ++requestIdRef.current;

      setEstimatedFiatValue(undefined); // before request starts
      convertToCurrency({
        amount: value,
        coinCode: selectedAccount.coinCode,
        fiatUnit: defaultCurrency,
      })
        .then(response => {
          if (requestId !== requestIdRef.current || !isMounted) {
            return;
          }

          if (response.success) {
            setEstimatedFiatValue(response.fiatAmount);
          } else {
            setEstimatedFiatValue(null);
          }
        })
        .catch(() => {
          if (requestId !== requestIdRef.current || !isMounted) {
            return;
          }
          setEstimatedFiatValue(null);
        });
    } else {
      setEstimatedFiatValue(null);
    }
  }, [defaultCurrency, isMounted, selectedAccount, value]);

  const displayedUnit = selectedAccount
    ? getDisplayedCoinUnit(selectedAccount.coinCode, selectedAccount.coinUnit, btcUnit)
    : undefined;

  return (
    <div className={style.accountWithInputContainer}>
      <div className={style.accountSelectorCol}>
        {hasAccounts && (
          <GroupedAccountSelector
            accounts={accounts}
            selected={accountCode}
            onChange={(accountCode => {
              const account = findAccount(accounts, accountCode);
              setSelectedAccount(account);
              onChangeAccountCode(accountCode);
            })}
            isAccountDisabled={isAccountDisabled}
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
            readOnly={readOnlyAmount}
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChangeValue && onChangeValue(event.target.value);
            }}
          />
          <span className={style.inputUnit}>
            {displayedUnit}
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
