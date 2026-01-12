/**
 * Copyright 2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { ChangeEvent } from 'react';
import type { AccountCode, TAccount } from '@/api/account';
import { Button, Label, NumberInput } from '@/components/forms';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import style from './input-with-account-selector.module.css';

type Props = {
  accountCode: AccountCode | undefined;
  accounts: TAccount[];
  id: string;
  onChangeAccountCode: (accountCode: AccountCode) => void;
  onChangeValue?: (value: string) => void;
  value: string | undefined;
  label: string;
};

export const InputWithAccountSelector = ({
  accountCode,
  accounts,
  id,
  onChangeAccountCode,
  onChangeValue,
  value,
  label,
}: Props) => {
  const hasAccounts = accounts && accounts.length > 0;
  return (
    <>
      <Label
        className={style.label}
        htmlFor="swapSendAmount">
        <span>
          {label}
        </span>
        <Button transparent>
          <small>
            Max 0.12345678 BTC
          </small>
        </Button>
      </Label>
      <div className={style.accountWithInputContainer}>
        <div className={style.accountSelectorCol}>
          {hasAccounts && (
            <GroupedAccountSelector
              accounts={accounts}
              selected={accountCode}
              onChange={onChangeAccountCode}
              stackedLayout
            />
          )}
        </div>
        <div className={style.inputCol}>
          <NumberInput
            transparent
            id={id}
            className={style.inputComponent}
            name={id}
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChangeValue && onChangeValue(event.target.value);
            }}
          />
        </div>
      </div>
    </>
  );
};