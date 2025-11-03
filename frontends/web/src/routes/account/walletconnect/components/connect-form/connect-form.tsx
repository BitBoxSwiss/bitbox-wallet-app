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
import { Button, Input } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { useMediaQuery } from '@/hooks/mediaquery';
import { ScanQRButton } from '@/routes/account/send/components/inputs/receiver-address-input';
import { ScanQRDialog } from '@/routes/account/send/components/dialogs/scan-qr-dialog';
import { ScanQRVideo } from '@/routes/account/send/components/inputs/scan-qr-video';
import styles from './connect-form.module.css';

type TWCConnectFormProps = {
    connectLoading: boolean;
    uri: string;
    onInputChange: (value: SetStateAction<string>) => void;
    onSubmit: (uri: string) => void;
}

type TMobileQRScannerProps = {
  onQRScanned: (uri: string) => void;
}

const MobileQRScanner = ({ onQRScanned }: TMobileQRScannerProps) => {
  return (
    <div className={styles.mobileQRScanner}>
      <ScanQRVideo onResult={onQRScanned} />
    </div>
  );
};

export const WCConnectForm = ({
  uri,
  onInputChange,
  onSubmit,
  connectLoading
}: TWCConnectFormProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeScanQR, setActiveScanQR] = useState(isMobile); // default to true on mobile

  const showMobileQRReader = isMobile;
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
          onInput={(e) => onInputChange(e.target.value.replace(/\s/g, ''))}>
          {(showQRButton && !connectLoading) && <ScanQRButton onClick={toggleScanQR} />}
        </Input>
        {activeScanQR && !isMobile && (
          <ScanQRDialog
            isMobile={isMobile}
            toggleScanQR={toggleScanQR}
            onChangeActiveScanQR={setActiveScanQR}
            parseQRResult={(uri: string) => onSubmit(uri)}
          />
        )}
        <div className={styles.formButtonsContainer}>
          <BackButton disabled={connectLoading}>
            {t('dialog.cancel')}
          </BackButton>
          <Button
            disabled={connectLoading || !uri}
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
