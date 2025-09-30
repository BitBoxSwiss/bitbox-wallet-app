/**
 * Copyright 2025 Shift Crypto AG
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

import { ChangeEvent, useCallback, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TOption } from '@/components/dropdown/dropdown';
import { InputWithDropdown } from '@/components/forms/input-with-dropdown';
import * as accountApi from '@/api/account';
import { getReceiveAddressList } from '@/api/account';
import { statusChanged, syncdone } from '@/api/accountsync';
import { unsubscribe } from '@/utils/subscriptions';
import { TUnsubscribe } from '@/utils/transport-common';
import { useMountedRef } from '@/hooks/mount';
import receiverStyles from './receiver-address-input.module.css';

type TAccountOption = TOption<accountApi.IAccount | null> & { disabled?: boolean };

export type TReceiverAddressWrapperProps = {
  accounts?: accountApi.IAccount[];
  currentAccount?: accountApi.IAccount;
  error?: string | object;
  onInputChange: (value: string) => void;
  onAddressChange?: (actualAddress: string) => void;
  recipientAddress: string;
  children?: React.ReactNode;
}

export const ReceiverAddressWrapper = ({
  accounts,
  currentAccount,
  error,
  onInputChange,
  onAddressChange,
  recipientAddress,
  children,
}: TReceiverAddressWrapperProps) => {
  const { t } = useTranslation();
  const mounted = useMountedRef();
  const [selectedAccount, setSelectedAccount] = useState<TOption<accountApi.IAccount | null> | null>(null);
  const [accountSyncStatus, setAccountSyncStatus] = useState<{[code: string]: accountApi.IStatus}>({});

  const sameCoinAccounts = useMemo(() =>
    accounts?.filter(acc =>
      acc.coinCode === currentAccount?.coinCode &&
      acc.active &&
      acc.code !== currentAccount?.code &&
      acc.keystore.rootFingerprint === currentAccount?.keystore.rootFingerprint
    ) || [], [accounts, currentAccount]);

  const shouldShowSendToAccountDropdown = sameCoinAccounts.length > 0;

  const accountOptions: TAccountOption[] = sameCoinAccounts.map(account => ({
    label: account.name,
    value: account,
    disabled: !accountSyncStatus[account.code]?.synced
  }));

  const handleSendToAccount = useCallback(async (selectedOption: TAccountOption) => {
    if (selectedOption.value === null || selectedOption.disabled) {
      return;
    }
    const selectedAccountValue = selectedOption.value;
    setSelectedAccount(selectedOption);
    try {
      const receiveAddresses = await getReceiveAddressList(selectedAccountValue.code)();
      if (receiveAddresses && receiveAddresses.length > 0 && receiveAddresses[0].addresses.length > 0) {
        const address = receiveAddresses[0].addresses[0].address;
        onInputChange(selectedAccountValue.name);
        onAddressChange?.(address);
      }
    } catch (e) {
      console.error(e);
    }
  }, [onInputChange, onAddressChange]);

  const handleReset = useCallback(() => {
    setSelectedAccount(null);
    onInputChange('');
    onAddressChange?.('');
  }, [onInputChange, onAddressChange]);

  const checkAccountStatus = useCallback(async (accountCode: accountApi.AccountCode) => {
    if (!mounted.current) {
      return;
    }
    const status = await accountApi.getStatus(accountCode);
    if (!mounted.current) {
      return;
    }
    setAccountSyncStatus(prev => ({
      ...prev,
      [accountCode]: status
    }));
  }, [mounted]);

  useEffect(() => {
    const subscriptions: TUnsubscribe[] = [];
    sameCoinAccounts.forEach(account => {
      checkAccountStatus(account.code);
      subscriptions.push(statusChanged(account.code, () => checkAccountStatus(account.code)));
      subscriptions.push(syncdone(account.code, () => checkAccountStatus(account.code)));
    });
    return () => unsubscribe(subscriptions);
  }, [sameCoinAccounts, checkAccountStatus]);

  return (
    <InputWithDropdown
      id="recipientAddress"
      label={selectedAccount ? t('account.account') : t('send.address.label')}
      error={error}
      align="left"
      placeholder={t('send.address.placeholder')}
      onInput={(e: ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value)}
      value={recipientAddress}
      disabled={selectedAccount !== null}
      autoFocus
      dropdownOptions={accountOptions}
      dropdownValue={selectedAccount}
      onDropdownChange={(selected) => {
        if (selected && selected.value !== null && !(selected as TAccountOption).disabled) {
          handleSendToAccount(selected as TAccountOption);
        }
      }}
      dropdownPlaceholder={t('send.sendToAccount.placeholder')}
      dropdownTitle={t('send.sendToAccount.title')}
      showDropdown={shouldShowSendToAccountDropdown && accountOptions.length > 0}
      isOptionDisabled={(option) => (option as TAccountOption).disabled || false}
      labelSection={selectedAccount ? (
        <span role="button" id="sendToSelf" className={receiverStyles.action} onClick={handleReset}>
          {t('generic.reset')}
        </span>
      ) : undefined}
    >
      {children}
    </InputWithDropdown>
  );
};
