
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

import { ChangeEvent, useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { getReceiveAddressList } from '@/api/account';
import { debug } from '@/utils/env';
import { InputWithDropdown } from '@/components/forms/input-with-dropdown';
import { TOption } from '@/components/dropdown/dropdown';
import { QRCodeLight, QRCodeDark } from '@/components/icon';
import { DarkModeContext } from '@/contexts/DarkmodeContext';
import { Input } from '@/components/forms';
import { useMediaQuery } from '@/hooks/mediaquery';
import { ScanQRDialog } from '@/routes/account/send/components/dialogs/scan-qr-dialog';
import style from './receiver-address-input.module.css';

type TReceiverAddressInputProps = {
    accountCode?: string;
    accounts?: accountApi.IAccount[];
    currentAccount?: accountApi.IAccount;
    addressError?: string;
    onInputChange: (value: string) => void;
    onAddressChange?: (actualAddress: string) => void;
    parseQRResult: (uri: string) => void;
    recipientAddress: string;
}
type TToggleScanQRButtonProps = {
  onClick: () => void;
  withDropdown?: boolean;
}

export const ScanQRButton = ({ onClick, withDropdown = false }: TToggleScanQRButtonProps) => {
  const { isDarkMode } = useContext(DarkModeContext);
  return (
    <button type="button" onClick={onClick} className={`${style.qrButton} ${withDropdown ? style.withDropdown : ''}`}>
      {isDarkMode ? <QRCodeLight /> : <QRCodeDark />}
    </button>);
};


export const ReceiverAddressInput = ({
  accountCode,
  accounts,
  currentAccount,
  addressError,
  onInputChange,
  onAddressChange,
  recipientAddress,
  parseQRResult
}: TReceiverAddressInputProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [selectedAccount, setSelectedAccount] = useState<TOption<accountApi.IAccount | null> | null>(null);
  const [activeScanQR, setActiveScanQR] = useState(false);


  const handleSendToSelf = useCallback(async () => {
    if (!accountCode) {
      return;
    }
    try {
      const receiveAddresses = await getReceiveAddressList(accountCode)();
      if (receiveAddresses && receiveAddresses.length > 0 && receiveAddresses[0].addresses.length > 0) {
        onInputChange(receiveAddresses[0].addresses[0].address);
      }
    } catch (e) {
      console.error(e);
    }
  }, [accountCode, onInputChange]);

  const sameCoinAccounts = accounts?.filter(acc =>
    acc.coinCode === currentAccount?.coinCode &&
    acc.active &&
    acc.code !== currentAccount?.code
  ) || [];

  const shouldShowSendToAccountDropdown = sameCoinAccounts.length > 0;

  const accountOptions: TOption<accountApi.IAccount | null>[] = sameCoinAccounts.map(account => ({
    label: account.name,
    value: account
  }));

  const handleSendToAccount = useCallback(async (selectedOption: TOption<accountApi.IAccount | null>) => {
    if (selectedOption.value === null) {
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

  const toggleScanQR = () => {
    handleReset();
    setActiveScanQR(activeScanQR => !activeScanQR);
  };

  return (
    <div>

      {accountOptions.length > 0 ? (
        <>
          <InputWithDropdown
            label={selectedAccount ? t('account.account') : t('send.address.label')}
            placeholder={t('send.address.placeholder')}
            id="recipientAddress"
            error={addressError}
            onInput={(e: ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value)}
            value={recipientAddress}
            disabled={selectedAccount !== null}
            labelSection={selectedAccount ? (<span role="button" id="sendToSelf" className={style.action} onClick={handleReset}>{t('generic.reset')}</span>) : undefined}
            autoFocus={true}
            showDropdown={shouldShowSendToAccountDropdown}
            dropdownOptions={accountOptions}
            dropdownValue={selectedAccount}
            onDropdownChange={handleSendToAccount}
            dropdownPlaceholder={t('send.sendToAccount.placeholder')}
            dropdownTitle={t('send.sendToAccount.title')}
          >
            <ScanQRButton onClick={toggleScanQR} withDropdown />
          </InputWithDropdown>
          {activeScanQR && (
            <ScanQRDialog
              toggleScanQR={toggleScanQR}
              onChangeActiveScanQR={setActiveScanQR}
              parseQRResult={parseQRResult}
            />
          )}
        </>
      ) : (
        <>
          {activeScanQR && (
            <ScanQRDialog
              toggleScanQR={toggleScanQR}
              onChangeActiveScanQR={setActiveScanQR}
              parseQRResult={parseQRResult}
            />
          )}
          <Input
            label={t('send.address.label')}
            placeholder={t('send.address.placeholder')}
            id="recipientAddress"
            error={addressError}
            onInput={(e: ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value)}
            value={recipientAddress}
            className={style.inputWithIcon}
            labelSection={debug ? (
              <span id="sendToSelf" className={`${style.action} ${style.sendToSelf}`} onClick={handleSendToSelf}>
              Send to self
              </span>
            ) : undefined}
            autoFocus={!isMobile}>
            <ScanQRButton onClick={toggleScanQR} />
          </Input>
        </>
      ) }

    </div>
  );
};
