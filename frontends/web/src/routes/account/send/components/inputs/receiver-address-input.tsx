/**
 * Copyright 2023 Shift Crypto AG
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

import { ChangeEvent, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { debug } from '../../../../../utils/env';
import { getReceiveAddressList } from '../../../../../api/account';
import DarkModeContext from '../../../../../contexts/DarkmodeContext';
import { useHasCamera } from '../../../../../hooks/qrcodescanner';
import { Input } from '../../../../../components/forms';
import { QRCodeLight, QRCodeDark } from '../../../../../components/icon';
import { ScanQRDialog } from '../dialogs/scan-qr-dialog';
import style from '../../send.module.css';

type TToggleScanQRButtonProps = {
    onClick: () => void;
}

type TReceiverAddressInputProps = {
    accountCode?: string;
    addressError?: string;
    onInputChange: (value: string) => void;
    recipientAddress: string;
    activeScanQR: boolean;
    parseQRResult: (uri: string) => void;
    onChangeActiveScanQR: (activeScanQR: boolean) => void
}

const ScanQRButton = ({ onClick }: TToggleScanQRButtonProps) => {
  const { isDarkMode } = useContext(DarkModeContext);
  return (
    <button onClick={onClick} className={style.qrButton}>
      {isDarkMode ? <QRCodeLight /> : <QRCodeDark />}
    </button>);
};

export const ReceiverAddressInput = ({
  accountCode,
  addressError,
  onInputChange,
  recipientAddress,
  activeScanQR,
  parseQRResult,
  onChangeActiveScanQR
}: TReceiverAddressInputProps) => {
  const { t } = useTranslation();
  const hasCamera = useHasCamera();

  const handleSendToSelf = async () => {
    if (!accountCode) {
      return;
    }
    try {
      const receiveAddresses = await getReceiveAddressList(accountCode)();
      if (receiveAddresses && receiveAddresses.length > 0 && receiveAddresses[0].addresses.length > 1) {
        onInputChange(receiveAddresses[0].addresses[0].address);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleScanQR = () => {
    if (activeScanQR) {
      onChangeActiveScanQR(false);
      return;
    }
    onChangeActiveScanQR(true);
  };

  return (
    <>
      <ScanQRDialog
        activeScanQR={activeScanQR}
        toggleScanQR={toggleScanQR}
        onChangeActiveScanQR={onChangeActiveScanQR}
        parseQRResult={parseQRResult}
      />
      <Input
        label={t('send.address.label')}
        placeholder={t('send.address.placeholder')}
        id="recipientAddress"
        error={addressError}
        onInput={(e: ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value)}
        value={recipientAddress}
        className={hasCamera ? style.inputWithIcon : ''}
        labelSection={debug ? (
          <span id="sendToSelf" className={style.action} onClick={handleSendToSelf}>
        Send to self
          </span>
        ) : undefined}
        autoFocus>
        { hasCamera && (
          <ScanQRButton onClick={toggleScanQR} />
        )}
      </Input>
    </>
  );
};