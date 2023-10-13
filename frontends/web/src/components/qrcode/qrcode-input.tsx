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
import DarkModeContext from '../../contexts/DarkmodeContext';
import { useHasCamera } from '../../hooks/qrcodescanner';
import { Input } from '../../components/forms';
import { QRCodeLight, QRCodeDark } from '../../components/icon';
import { ScanQRDialog } from './scan-qr-dialog';
import style from './qrcode-input.module.css';

type TToggleScanQRButtonProps = {
  onClick: () => void;
};

type TQrCodeInputProps = {
  title: string;
  label: string;
  placeholder: string;
  inputError?: string;
  labelSection?: JSX.Element;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
  activeScanQR: boolean;
  parseQRResult: (uri: string) => void;
  onChangeActiveScanQR: (activeScanQR: boolean) => void;
};

const ScanQRButton = ({ onClick }: TToggleScanQRButtonProps) => {
  const { isDarkMode } = useContext(DarkModeContext);
  return (
    <button onClick={onClick} className={style.qrButton}>
      {isDarkMode ? <QRCodeLight /> : <QRCodeDark />}
    </button>
  );
};

export const QrCodeInput = ({
  title,
  label,
  placeholder,
  inputError,
  labelSection,
  onInputChange,
  value,
  activeScanQR,
  parseQRResult,
  onChangeActiveScanQR
}: TQrCodeInputProps) => {
  const hasCamera = useHasCamera();

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
        title={title}
        activeScanQR={activeScanQR}
        toggleScanQR={toggleScanQR}
        onChangeActiveScanQR={onChangeActiveScanQR}
        parseQRResult={parseQRResult}
      />
      <Input
        label={label}
        placeholder={placeholder}
        id="qrCodeInput"
        error={inputError}
        onInput={onInputChange}
        value={value}
        className={hasCamera ? style.inputWithIcon : ''}
        labelSection={labelSection}
        autoFocus
      >
        {hasCamera && <ScanQRButton onClick={toggleScanQR} />}
      </Input>
    </>
  );
};
