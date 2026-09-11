// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { alertUser } from '@/components/alert/Alert';
import { TGroupedOption, TOption } from '@/components/dropdown/dropdown';
import { InputWithDropdown } from '@/components/forms/input-with-dropdown';
import * as accountApi from '@/api/account';
import { getReceiveAddressList, TAccount } from '@/api/account';
import { statusChanged, syncdone } from '@/api/accountsync';
import { connectKeystore, getKeystoreFeatures } from '@/api/keystores';
import { unsubscribe } from '@/utils/subscriptions';
import { TUnsubscribe } from '@/utils/transport-common';
import { useMountedRef } from '@/hooks/mount';
import { useMobileLayout } from '@/hooks/mobile-layout';
import { FirmwareUpgradeRequiredDialog } from '@/components/dialog/firmware-upgrade-required-dialog';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { Logo } from '@/components/icon';
import { renderKeystoreGroupHeader } from '@/components/groupedaccountselector/groupedaccountselector';
import { getAccountsByKeystore, getDisplayAccountNumber, isAmbiguousName } from '@/routes/account/utils';
import receiverStyles from './receiver-address-input.module.css';
import styles from './receiver-address-wrapper.module.css';

type TAccountOption = TOption<TAccount | null> & { disabled?: boolean };

type Props = {
  option: TAccountOption;
  isSelectedValue: boolean;
};

type TReceiverAddressWrapperProps = {
  accounts?: TAccount[];
  autoFocus?: boolean;
  classNameInputField?: string;
  error?: string | object;
  groupAccountsByKeystore?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  onInputChange: (value: string) => void;
  onAccountChange?: (account: TAccount | null) => void;
  recipientAddress: string;
  requireSendToSelfSupport?: boolean;
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
  autoFocus,
  classNameInputField,
  error,
  groupAccountsByKeystore = false,
  inputLabel,
  inputPlaceholder,
  onInputChange,
  onAccountChange,
  recipientAddress,
  requireSendToSelfSupport = true,
  children,
}: TReceiverAddressWrapperProps) => {
  const { t } = useTranslation();
  const [showFirmwareUpgradeDialog, setShowFirmwareUpgradeDialog] = useState(false);
  const mounted = useMountedRef();
  const isMobile = useMobileLayout();
  const [selectedAccount, setSelectedAccount] = useState<TOption<TAccount | null> | null>(null);
  const [accountSyncStatus, setAccountSyncStatus] = useState<{ [code: string]: accountApi.TStatus }>({});

  const toAccountOption = (account: TAccount): TAccountOption => {
    const accountNumber = getDisplayAccountNumber(account.accountNumber);

    return {
      label: `${account.name}${accountNumber !== undefined ? ` (Account #${accountNumber})` : ''}`,
      value: account,
      disabled: !accountSyncStatus[account.code]?.synced
    };
  };
  const flatAccountOptions = accounts?.map(toAccountOption) ?? [];
  const accountsByKeystore = getAccountsByKeystore(accounts ?? []);
  const groupedAccountOptions: TGroupedOption<TAccount | null, { connected: boolean }>[] = accountsByKeystore.map(({ keystore, accounts }) => ({
    connected: keystore.connected,
    label: isAmbiguousName(keystore.name, accountsByKeystore)
      ? `${keystore.name} (${keystore.rootFingerprint})`
      : keystore.name,
    options: accounts.map(toAccountOption),
  }));
  const accountOptions = groupAccountsByKeystore ? groupedAccountOptions : flatAccountOptions;

  const checkFirmwareSupport = useCallback(async (selectedAccount: accountApi.TAccount) => {
    if (!requireSendToSelfSupport) {
      return true;
    }
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
  }, [requireSendToSelfSupport, t]);

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
        label={inputLabel ?? t('send.address.label')}
        classNameInputField={classNameInputField}
        error={error}
        align="left"
        placeholder={inputPlaceholder ?? t('send.address.placeholder')}
        onInput={(e: ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value)}
        value={recipientAddress}
        readOnly={selectedAccount !== null}
        autoFocus={autoFocus ?? !isMobile}
        dropdownOptions={accountOptions}
        dropdownValue={selectedAccount}
        onDropdownChange={(selected) => {
          if (selected && selected.value !== null && !(selected as TAccountOption).disabled) {
            handleSendToAccount(selected as TAccountOption);
          }
        }}
        dropdownPlaceholder={t('send.sendToAccount.placeholder')}
        dropdownTitle={t('send.sendToAccount.title')}
        renderGroupHeader={groupAccountsByKeystore ? renderKeystoreGroupHeader : undefined}
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
