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

import { SetStateAction, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../../../../components/forms';
import { route } from '../../../../../utils/route';
import { useMediaQuery } from '../../../../../hooks/mediaquery';
import { ScanQRButton } from '../../../send/components/inputs/receiver-address-input';
import { useHasCamera } from '../../../../../hooks/qrcodescanner';
import { ScanQRDialog } from '../../../send/components/dialogs/scan-qr-dialog';
import { ScanQRVideo } from '../../../send/components/inputs/scan-qr-video';
import styles from './connect-form.module.css';

type TWCConnectFormProps = {
    code: string;
    connectLoading: boolean;
    uri: string;
    onInputChange: (value: SetStateAction<string>) => void;
    onSubmit: (uri: string) => void;
}

type TMobileQRScannerProps = {
  onQRScanned: (uri: string) => void;
}

const MobileQRScanner = ({ onQRScanned }: TMobileQRScannerProps) => {
  const { t } = useTranslation();
  return (
    <div className={styles.mobileQRScanner}>
      <p className={styles.scanQRLabel}>{t('send.scanQR')}</p>
      <ScanQRVideo onResult={onQRScanned} />
    </div>
  );
};

export const WCConnectForm = ({
  code,
  uri,
  onInputChange,
  onSubmit,
  connectLoading
}: TWCConnectFormProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const hasCamera = useHasCamera();
  const [activeScanQR, setActiveScanQR] = useState(isMobile); // default to true on mobile

  const showMobileQRReader = isMobile && hasCamera;
  const showQRButton = !isMobile;


  const toggleScanQR = () => {
    if (activeScanQR) {
      setActiveScanQR(false);
      return;
    }
    setActiveScanQR(true);
  };

  return (
    <div className={styles.formContainer}>
      {showMobileQRReader && <MobileQRScanner onQRScanned={onSubmit} />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(uri);
        }}>
        <Input
          label={t('walletConnect.connect.dappLabel')}
          className={showQRButton ? styles.inputWithIcon : ''}
          value={uri}
          readOnly={connectLoading}
          onInput={(e) => onInputChange(e.target.value)}>
          {(showQRButton && !connectLoading) && <ScanQRButton onClick={toggleScanQR} />}
        </Input>
        <ScanQRDialog
          activeScanQR={activeScanQR && !isMobile}
          toggleScanQR={toggleScanQR}
          onChangeActiveScanQR={setActiveScanQR}
          parseQRResult={(uri: string) => onSubmit(uri)}
        />
        <div className={styles.formButtonsContainer}>
          <Button
            disabled={connectLoading}
            secondary
            onClick={() => route(`/account/${code}/wallet-connect/dashboard`)}>
            {t('dialog.cancel')}
          </Button>
          <Button
            disabled={connectLoading}
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
