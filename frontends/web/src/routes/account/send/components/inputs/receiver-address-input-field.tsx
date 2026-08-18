// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import type { TAccount } from '@/api/account';
import { Input } from '@/components/forms';
import { PasteDark, PasteLight, QRCodeDark, QRCodeLight } from '@/components/icon';
import { DarkModeContext } from '@/contexts/DarkmodeContext';
import { ReceiverAddressWrapper } from './receiver-address-wrapper';
import styles from './receiver-address-input-field.module.css';

type TIconButtonProps = {
  onClick: () => void;
};

type TProps = {
  accounts?: TAccount[];
  autoFocus?: boolean;
  error?: string | object;
  groupAccountsByKeystore?: boolean;
  inputLabel: string;
  inputPlaceholder: string;
  labelSection?: JSX.Element;
  onAccountChange?: (account: TAccount | null) => void;
  onInputChange: (value: string) => void;
  onScanQR: () => void;
  recipientAddress: string;
  requireSendToSelfSupport?: boolean;
};

export const ScanQRButton = ({ onClick }: TIconButtonProps) => {
  const { isDarkMode } = useContext(DarkModeContext);
  return (
    <button type="button" onClick={onClick} className={`${styles.iconButton || ''} ${styles.qrButton || ''}`}>
      {isDarkMode ? <QRCodeLight /> : <QRCodeDark />}
    </button>
  );
};

const PasteButton = ({ onClick }: TIconButtonProps) => {
  const { isDarkMode } = useContext(DarkModeContext);
  return (
    <button type="button" onClick={onClick} className={`${styles.iconButton || ''} ${styles.pasteButton || ''}`}>
      {isDarkMode ? <PasteLight /> : <PasteDark />}
    </button>
  );
};

export const ReceiverAddressInputField = ({
  accounts = [],
  autoFocus,
  error,
  groupAccountsByKeystore,
  inputLabel,
  inputPlaceholder,
  labelSection,
  onAccountChange,
  onInputChange,
  onScanQR,
  recipientAddress,
  requireSendToSelfSupport,
}: TProps) => {
  const handlePaste = async () => {
    if (!navigator.clipboard?.readText) {
      return;
    }
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (value) {
        onInputChange(value);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const inputActions = (
    <>
      <ScanQRButton onClick={onScanQR} />
      <PasteButton onClick={handlePaste} />
    </>
  );

  if (accounts.length > 0) {
    return (
      <ReceiverAddressWrapper
        accounts={accounts}
        autoFocus={autoFocus}
        error={error}
        groupAccountsByKeystore={groupAccountsByKeystore}
        inputLabel={inputLabel}
        inputPlaceholder={inputPlaceholder}
        onInputChange={onInputChange}
        onAccountChange={onAccountChange}
        recipientAddress={recipientAddress}
        requireSendToSelfSupport={requireSendToSelfSupport}
      >
        {inputActions}
      </ReceiverAddressWrapper>
    );
  }

  return (
    <Input
      autoFocus={autoFocus}
      id="recipientAddress"
      label={inputLabel}
      placeholder={inputPlaceholder}
      error={error}
      onInput={e => onInputChange(e.currentTarget.value)}
      value={recipientAddress}
      className={styles.inputWithIcon}
      classNameInputField={styles.inputFieldWithIcon}
      labelSection={labelSection}
    >
      {inputActions}
    </Input>
  );
};
