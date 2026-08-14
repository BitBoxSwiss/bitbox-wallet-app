// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { getReceiveAddressList } from '@/api/account';
import { debug } from '@/utils/env';
import { ReceiverAddressInputField } from './receiver-address-input-field';
import { useMediaQuery } from '@/hooks/mediaquery';
import { ScanQR } from './scan-qr';
import { isBitcoinBased } from '@/routes/account/utils';
import style from './receiver-address-input.module.css';

type TReceiverAddressInputProps = {
  account?: accountApi.TAccount;
  activeAccounts?: accountApi.TAccount[];
  addressError?: string;
  onInputChange: (value: string) => void;
  onAccountChange?: (account: accountApi.TAccount | null) => void;
  parseQRResult: (uri: string) => void;
  recipientAddress: string;
};

export const ReceiverAddressInput = ({
  account,
  activeAccounts,
  addressError,
  onInputChange,
  onAccountChange,
  recipientAddress,
  parseQRResult
}: TReceiverAddressInputProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeScanQR, setActiveScanQR] = useState(false);
  const accountCode = account?.code;

  const accountsForReceiverDropdown = useMemo(() =>
    activeAccounts?.filter(acc =>
      isBitcoinBased(acc.coinCode) &&
      acc.coinCode === account?.coinCode &&
      acc.active &&
      acc.keystore.rootFingerprint === account?.keystore.rootFingerprint
    ) || [], [activeAccounts, account]);

  const parseQRResultRef = useRef(parseQRResult);
  parseQRResultRef.current = parseQRResult;

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

  const toggleScanQR = useCallback(() => {
    setActiveScanQR(prev => !prev);
  }, []);

  const handleParseQRResult = useCallback((result: string) => {
    parseQRResultRef.current(result);
  }, []);

  return (
    <>
      {activeScanQR && (
        <ScanQR
          onResult={handleParseQRResult}
          onClose={() => setActiveScanQR(false)}
          instruction={t('send.scanQRInstruction')}
        />
      )}
      <ReceiverAddressInputField
        accounts={accountsForReceiverDropdown}
        autoFocus={!isMobile}
        error={addressError}
        inputLabel={t('send.address.label')}
        inputPlaceholder={t('send.address.placeholder')}
        labelSection={debug ? (
          <span id="sendToSelf" className={`${style.action || ''} ${style.sendToSelf || ''}`} onClick={handleSendToSelf}>
            Send to self
          </span>
        ) : undefined}
        onInputChange={onInputChange}
        onAccountChange={onAccountChange}
        onScanQR={toggleScanQR}
        recipientAddress={recipientAddress}
      />
    </>
  );
};
