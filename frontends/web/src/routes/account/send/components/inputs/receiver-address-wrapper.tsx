// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { alertUser } from '@/components/alert/Alert';
import { TOption } from '@/components/dropdown/dropdown';
import { InputWithDropdown } from '@/components/forms/input-with-dropdown';
import * as accountApi from '@/api/account';
import { getReceiveAddressList, TAccount } from '@/api/account';
import { statusChanged, syncdone } from '@/api/accountsync';
import { connectKeystore, getKeystoreFeatures } from '@/api/keystores';
import { unsubscribe } from '@/utils/subscriptions';
import { TUnsubscribe } from '@/utils/transport-common';
import { useMountedRef } from '@/hooks/mount';
import { useMediaQuery } from '@/hooks/mediaquery';
import { FirmwareUpgradeRequiredDialog } from '@/components/dialog/firmware-upgrade-required-dialog';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { Logo } from '@/components/icon';
import receiverStyles from './receiver-address-input.module.css';
import styles from './receiver-address-wrapper.module.css';

type TAccountOption = TOption<TAccount | null> & { disabled?: boolean };

type Props = {
  option: TAccountOption;
  isSelectedValue: boolean;
};

type TReceiverAddressWrapperProps = {
  accounts?: TAccount[];
  error?: string | object;
  onInputChange: (value: string) => void;
  onAccountChange?: (account: TAccount | null) => void;
  recipientAddress: string;
  children?: React.ReactNode;
};

const AccountOption = ({ option, isSelectedValue }: Props) => {
  if (!option.value) {
    return <span>{option.label}</span>;
  }

  return (
    <div className={`${styles.accountOption || ''}`}>
      <Logo coinCode={option.value.coinCode} alt={option.value.coinName} className={styles.coinLogo} />
      <span className={isSelectedValue ? styles.accountName : ''}>
        {option.label}
      </span>
      {option.disabled && <span className={styles.spinner}><SpinnerRingAnimated /></span>}
    </div>
  );
};


export const ReceiverAddressWrapper = ({
  accounts,
  error,
  onInputChange,
  onAccountChange,
  recipientAddress,
  children,
}: TReceiverAddressWrapperProps) => {
  const { t } = useTranslation();
  const [showFirmwareUpgradeDialog, setShowFirmwareUpgradeDialog] = useState(false);
  const mounted = useMountedRef();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [selectedAccount, setSelectedAccount] = useState<TOption<TAccount | null> | null>(null);
  const [accountSyncStatus, setAccountSyncStatus] = useState<{ [code: string]: accountApi.TStatus }>({});

  const accountOptions: TAccountOption[] = accounts && accounts.length > 0 ? accounts.map(account => {
    const accountNumber = account.accountNumber;

    return {
      label: `${account.name} ${accountNumber ? `(Account #${accountNumber + 1})` : ''}`,
      value: account,
      disabled: !accountSyncStatus[account.code]?.synced
    };
  }) : [];

  const checkFirmwareSupport = useCallback(async (selectedAccount: accountApi.TAccount) => {
    const rootFingerprint = selectedAccount.keystore.rootFingerprint;
    const connectResult = await connectKeystore(rootFingerprint);
    if (!connectResult.success) {
      return false;
    }
    const featuresResult = await getKeystoreFeatures(rootFingerprint);
    if (!featuresResult.success) {
      alertUser(featuresResult.errorMessage || t('genericError'));
      return false;
    }
    if (!featuresResult.features?.supportsSendToSelf) {
      setShowFirmwareUpgradeDialog(true);
      return false;
    }
    return true;
  }, [t]);

  const handleSendToAccount = useCallback(async (selectedOption: TAccountOption) => {
    if (selectedOption.value === null || selectedOption.disabled) {
      return;
    }
    const selectedAccountValue = selectedOption.value;

    const supported = await checkFirmwareSupport(selectedAccountValue);
    if (!supported) {
      return;
    }
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
  }, [onInputChange, onAccountChange, checkFirmwareSupport]);

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
    <>
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
      <FirmwareUpgradeRequiredDialog
        open={showFirmwareUpgradeDialog}
        onClose={() => setShowFirmwareUpgradeDialog(false)}
      />
    </>
  );
};
