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

import { ChangeEvent, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TOption } from '@/components/dropdown/dropdown';
import { InputWithDropdown } from '@/components/forms/input-with-dropdown';
import * as accountApi from '@/api/account';
import { getReceiveAddressList, IAccount } from '@/api/account';
import { statusChanged, syncdone } from '@/api/accountsync';
import { unsubscribe } from '@/utils/subscriptions';
import { TUnsubscribe } from '@/utils/transport-common';
import { useMountedRef } from '@/hooks/mount';
import { useMediaQuery } from '@/hooks/mediaquery';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { Logo } from '@/components/icon';
import { getAccountNumber } from '@/routes/account/utils';
import receiverStyles from './receiver-address-input.module.css';
import styles from './receiver-address-wrapper.module.css';

type TAccountOption = TOption<IAccount | null> & { disabled?: boolean };

type Props = {
  option: TAccountOption,
  isSelectedValue: boolean
}

type TReceiverAddressWrapperProps = {
  accounts?: IAccount[];
  allAccounts?: IAccount[];
  error?: string | object;
  onInputChange: (value: string) => void;
  onAccountChange?: (account: IAccount | null) => void;
  recipientAddress: string;
  children?: React.ReactNode;
}

const AccountOption = ({ option, isSelectedValue }: Props) => {
  if (!option.value) {
    return <span>{option.label}</span>;
  }

  return (
    <div className={`${styles.accountOption || ''}`}>
      <Logo coinCode={option.value.coinCode} alt={option.value.coinName} className={styles.coinLogo} />
      <span className={
        isSelectedValue ?
          styles.accountName : ''
      }>{option.label}</span>
      {option.disabled && <span className={styles.spinner}><SpinnerRingAnimated /></span>}
    </div>
  );
};


export const ReceiverAddressWrapper = ({
  accounts,
  allAccounts,
  error,
  onInputChange,
  onAccountChange,
  recipientAddress,
  children,
}: TReceiverAddressWrapperProps) => {
  const { t, i18n } = useTranslation();
  const mounted = useMountedRef();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [selectedAccount, setSelectedAccount] = useState<TOption<IAccount | null> | null>(null);
  const [accountSyncStatus, setAccountSyncStatus] = useState<{ [code: string]: accountApi.IStatus }>({});

  const accountOptions: TAccountOption[] = accounts && accounts.length > 0 ? accounts.map(account => {
    const accountNumber = getAccountNumber(account, allAccounts || accounts, i18n.language);

    return {
      label: `${account.name} ${accountNumber ? `(Account #${accountNumber})` : ''}`,
      value: account,
      disabled: !accountSyncStatus[account.code]?.synced
    };
  }) : [];

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
        onInputChange(address);
        onAccountChange?.(selectedAccountValue);
      }
    } catch (e) {
      console.error(e);
    }
  }, [onInputChange, onAccountChange]);

  const handleReset = useCallback(() => {
    setSelectedAccount(null);
    onInputChange('');
    onAccountChange?.(null);
  }, [onInputChange, onAccountChange]);

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
    if (!accounts || accounts.length === 0) {
      return;
    }

    const subscriptions: TUnsubscribe[] = [];
    accounts.forEach(account => {
      checkAccountStatus(account.code);
      subscriptions.push(statusChanged(account.code, () => checkAccountStatus(account.code)));
      subscriptions.push(syncdone(account.code, () => checkAccountStatus(account.code)));
    });
    return () => unsubscribe(subscriptions);
  }, [accounts, checkAccountStatus]);

  return (
    <InputWithDropdown
      id="recipientAddress"
      label={t('send.address.label')}
      error={error}
      align="left"
      placeholder={t('send.address.placeholder')}
      onInput={(e: ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value)}
      value={recipientAddress}
      disabled={selectedAccount !== null}
      autoFocus={!isMobile}
      dropdownOptions={accountOptions}
      dropdownValue={selectedAccount}
      onDropdownChange={(selected) => {
        if (selected && selected.value !== null && !(selected as TAccountOption).disabled) {
          handleSendToAccount(selected as TAccountOption);
        }
      }}
      dropdownPlaceholder={t('send.sendToAccount.placeholder')}
      dropdownTitle={t('send.sendToAccount.title')}
      renderOptions={(e, isSelectedValue) => <AccountOption option={e} isSelectedValue={isSelectedValue} />}
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
