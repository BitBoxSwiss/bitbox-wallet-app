// SPDX-License-Identifier: Apache-2.0

import { SetStateAction, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/components/forms';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { useMediaQuery } from '@/hooks/mediaquery';
import { ScanQRButton } from '@/routes/account/send/components/inputs/receiver-address-input-field';
import { ScanQR } from '@/routes/account/send/components/inputs/scan-qr';
import styles from './connect-form.module.css';

type TWCConnectFormProps = {
  connectLoading: boolean;
  uri: string;
  onInputChange: (value: SetStateAction<string>) => void;
  onSubmit: (uri: string) => void;
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

  const toggleScanQR = () => setActiveScanQR(prev => !prev);

  return (
    <div className={styles.formContainer}>
      {activeScanQR && (
        <ScanQR
          onResult={(result: string) => onSubmit(result)}
          onClose={() => setActiveScanQR(false)}
          instruction={t('walletConnect.connect.scanInstruction')}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(uri);
        }}>
        <Input
          label={t('walletConnect.connect.dappLabel')}
          classNameInputField={styles.inputFieldWithIcon}
          value={uri}
          readOnly={connectLoading}
          onInput={(e) => onInputChange(e.target.value.replace(/\s/g, ''))}>
          {!connectLoading && <ScanQRButton onClick={toggleScanQR} />}
        </Input>
        <div className={styles.formButtonsContainer}>
          <DesktopBackButton disabled={connectLoading}>
            {t('dialog.cancel')}
          </DesktopBackButton>
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
