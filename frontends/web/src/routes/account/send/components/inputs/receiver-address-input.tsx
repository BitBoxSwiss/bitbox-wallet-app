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
import { getReceiveAddressList } from '@/api/account';
import { debug } from '@/utils/env';
import { DarkModeContext } from '@/contexts/DarkmodeContext';
import { Input } from '@/components/forms';
import { QRCodeLight, QRCodeDark } from '@/components/icon';
import { ScanQRDialog } from '@/routes/account/send/components/dialogs/scan-qr-dialog';
import style from './receiver-address-input.module.css';

type TToggleScanQRButtonProps = {
  onClick: () => void;
};

type TReceiverAddressInputProps = {
  accountCode?: string;
  addressError?: string;
  onInputChange: (value: string) => void;
  recipientAddress: string;
  parseQRResult: (uri: string) => void;
};

export const ScanQRButton = ({ onClick }: TToggleScanQRButtonProps) => {
  const { isDarkMode } = useContext(DarkModeContext);
  return (
    <button type="button" onClick={onClick} className={style.qrButton}>
      {isDarkMode ? <QRCodeLight /> : <QRCodeDark />}
    </button>
  );
};

export const ReceiverAddressInput = ({
  accountCode,
  addressError,
  onInputChange,
  recipientAddress,
  parseQRResult,
}: TReceiverAddressInputProps) => {
  const { t } = useTranslation();
  const [activeScanQR, setActiveScanQR] = useState(false);

  const handleSendToSelf = useCallback(async () => {
    if (!accountCode) {
      return;
    }
    try {
      const receiveAddresses = await getReceiveAddressList(accountCode)();
      if (
        receiveAddresses &&
        receiveAddresses.length > 0 &&
        receiveAddresses[0].addresses.length > 1
      ) {
        onInputChange(receiveAddresses[0].addresses[0].address);
      }
    } catch (e) {
      console.error(e);
    }
  }, [accountCode, onInputChange]);

  const toggleScanQR = () => {
    setActiveScanQR((activeScanQR) => !activeScanQR);
  };

  return (
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
        onInput={(e: ChangeEvent<HTMLInputElement>) =>
          onInputChange(e.target.value)
        }
        value={recipientAddress}
        className={style.inputWithIcon}
        labelSection={
          debug ? (
            <span
              id="sendToSelf"
              className={style.action}
              onClick={handleSendToSelf}
            >
              Send to self
            </span>
          ) : undefined
        }
        autoFocus
      >
        <ScanQRButton onClick={toggleScanQR} />
      </Input>
    </>
  );
};
