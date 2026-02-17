// SPDX-License-Identifier: Apache-2.0

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
};

type TMobileQRScannerProps = {
  onQRScanned: (uri: string) => void;
};

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
          classNameInputField={showQRButton ? styles.inputFieldWithIcon : ''}
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
