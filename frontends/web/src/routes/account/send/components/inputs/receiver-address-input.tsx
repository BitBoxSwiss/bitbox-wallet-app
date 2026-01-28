// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { getReceiveAddressList } from '@/api/account';
import { debug } from '@/utils/env';
import { ReceiverAddressWrapper } from './receiver-address-wrapper';
import { QRCodeLight, QRCodeDark } from '@/components/icon';
import { DarkModeContext } from '@/contexts/DarkmodeContext';
import { Input } from '@/components/forms';
import { useMediaQuery } from '@/hooks/mediaquery';
import { ScanQRDialog } from '@/routes/account/send/components/dialogs/scan-qr-dialog';
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

type TToggleScanQRButtonProps = {
  onClick: () => void;
  withDropdown?: boolean;
};

export const ScanQRButton = ({ onClick, withDropdown = false }: TToggleScanQRButtonProps) => {
  const { isDarkMode } = useContext(DarkModeContext);
  return (
    <button type="button" onClick={onClick} className={`
     ${style.qrButton || ''}
     ${withDropdown ? style.withDropdown || '' : ''}`
    }>
      {isDarkMode ? <QRCodeLight /> : <QRCodeDark />}
    </button>
  );
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

  const isMobileSnapshotRef = useRef<boolean>(isMobile);
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
    setActiveScanQR(prev => {
      if (!prev) {
        isMobileSnapshotRef.current = isMobile;
      }
      return !prev;
    });
  }, [isMobile]);

  const handleParseQRResult = useCallback((result: string) => {
    parseQRResultRef.current(result);
  }, []);

  return (
    <>
      {activeScanQR && (
        <ScanQRDialog
          toggleScanQR={toggleScanQR}
          onChangeActiveScanQR={setActiveScanQR}
          parseQRResult={handleParseQRResult}
          isMobile={isMobileSnapshotRef.current}
        />
      )}
      {!accountsForReceiverDropdown || accountsForReceiverDropdown.length === 0 ? (
        <Input
          label={t('send.address.label')}
          placeholder={t('send.address.placeholder')}
          id="recipientAddress"
          error={addressError}
          onInput={(e: ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value)}
          value={recipientAddress}
          className={style.inputWithIcon}
          labelSection={debug ? (
            <span id="sendToSelf" className={`${style.action || ''} ${style.sendToSelf || ''}`} onClick={handleSendToSelf}>
              Send to self
            </span>
          ) : undefined}
          autoFocus={!isMobile}>
          <ScanQRButton onClick={toggleScanQR} />
        </Input>
      ) : (
        <ReceiverAddressWrapper
          accounts={accountsForReceiverDropdown}
          error={addressError}
          onInputChange={onInputChange}
          onAccountChange={onAccountChange}
          recipientAddress={recipientAddress}
        >
          <ScanQRButton onClick={toggleScanQR} withDropdown />
        </ReceiverAddressWrapper>
      )}
    </>
  );
};

