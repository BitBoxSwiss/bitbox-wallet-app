
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

import { SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../../../../components/forms';
import { route } from '../../../../../utils/route';
import { useQRCodeScanner } from '../../../../../hooks/qrcodescanner';
import { useMediaQuery } from '../../../../../hooks/mediaquery';
import { BrowserQRCodeReader } from '@zxing/library';
import { QRVideo, ScanQRDialog } from '../../../../../components/scanqrdialog/scan-qr-dialog';
import { ScanQRButton } from '../../../send/components/inputs/receiver-address-input';
import { alertUser } from '../../../../../components/alert/Alert';
import styles from './connect-form.module.css';

type TWCConnectFormProps = {
    code: string;
    uri: string;
    onInputChange: (value: SetStateAction<string>) => void;
    onSubmit: (uri: string) => void;
}

const MobileQRScanner = () => {
  const { t } = useTranslation();
  return (
    <div className={styles.mobileQRScanner}>
      <p className={styles.scanQRLabel}>{t('send.scanQR')}</p>
      <QRVideo />
    </div>
  );
};

export const WCConnectForm = ({ code, uri, onInputChange, onSubmit }: TWCConnectFormProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const qrCodeReaderRef = useRef<BrowserQRCodeReader>();
  const [activeScanQR, setActiveScanQR] = useState(isMobile ? true : false); // default to true on mobile
  const handleQRScanError = (error: any) => {
    // Preventing error alerting when user on mobile
    // navigates from WC connect screen to another page
    // (this error is 'classified' as NotFoundException).
    if (error.toString().includes('NotFoundException') && isMobile) {
      return;
    }
    // Otherwise, alert as normal.
    alertUser(error.message || error);
  };

  const hasCamera = useQRCodeScanner({
    onError: handleQRScanError,
    qrCodeReaderRef,
    activeScanQR,
    onChangeActiveScanQR: () => setActiveScanQR(false),
    parseQRResult: (uri: string) => onSubmit(uri)
  });


  const showMobileQRReader = isMobile && hasCamera;
  const showQRButton = !isMobile && hasCamera;

  const deactivateQRScanner = () => {
    if (qrCodeReaderRef.current) {
      // release camera;
      qrCodeReaderRef.current.reset();
    }
    setActiveScanQR(false);
    return;
  };

  const toggleScanQR = useCallback(() => {
    if (activeScanQR) {
      deactivateQRScanner();
    }

    // if, for some reason, mobile has no camera
    if (isMobile && !hasCamera) {
      setActiveScanQR(false);
      return;
    }

    setActiveScanQR(true);
  }, [activeScanQR, hasCamera, isMobile]);

  useEffect(() => {
    // tries to automatically activate QR reader functionality
    // on mobile during page load.
    if (isMobile) {
      toggleScanQR();
      return;
    }

  }, [activeScanQR, isMobile, toggleScanQR]);


  return (
    <div className={styles.formContainer}>
      {showMobileQRReader && <MobileQRScanner />}
      <form
        className={showMobileQRReader ? styles.showMobileQRReader : ''}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(uri);
        }}>
        <Input
          label={t('walletConnect.connect.dappLabel')}
          className={showQRButton ? styles.inputWithIcon : ''}
          value={uri}
          onInput={(e) => onInputChange(e.target.value)}>
          {showQRButton && <ScanQRButton onClick={toggleScanQR} />}
        </Input>
        <ScanQRDialog activeScanQR={activeScanQR && !isMobile} onToggleScanQR={toggleScanQR} />
        <div className={styles.formButtonsContainer}>
          <Button
            secondary
            onClick={() => route(`/account/${code}/wallet-connect/dashboard`)}>
            {t('dialog.cancel')}
          </Button>
          <Button
            type="submit"
            primary
          >
            {t('walletConnect.connect.button')}
          </Button>
        </div>
      </form>
    </div>
  );
};
