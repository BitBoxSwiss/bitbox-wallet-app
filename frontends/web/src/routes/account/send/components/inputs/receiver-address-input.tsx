import { ChangeEvent, SyntheticEvent, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { debug } from '../../../../../utils/env';
import { getReceiveAddressList } from '../../../../../api/account';
import DarkModeContext from '../../../../../contexts/DarkmodeContext';
import { Input } from '../../../../../components/forms';
import qrcodeIconDark from '../../../../../assets/icons/qrcode-dark.png';
import qrcodeIconLight from '../../../../../assets/icons/qrcode-light.png';
import style from '../../send.module.css';
import { ScanQRDialog } from '../dialogs/scan-qr-dialog';
import { BrowserQRCodeReader } from '@zxing/library';
import { alertUser } from '../../../../../components/alert/Alert';

type TToggleScanQRButtonProps = {
    onClick: () => void;
}

type TReceiverAddressInputProps = {
    accountCode?: string;
    addressError?: string;
    onClickSendToSelfButton: (e: SyntheticEvent, receiveAddress: string) => void;
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
      <img src={isDarkMode ? qrcodeIconLight : qrcodeIconDark} />
    </button>);
};

export const ReceiverAddressInput = ({
  accountCode,
  addressError,
  onInputChange,
  onClickSendToSelfButton,
  recipientAddress,
  activeScanQR,
  parseQRResult,
  onChangeActiveScanQR
}: TReceiverAddressInputProps) => {
  const { t } = useTranslation();
  const [hasCamera, setHasCamera] = useState(false);
  const qrCodeReader = useRef<BrowserQRCodeReader>();

  useEffect(() => {
    import('../../../../../components/qrcode/qrreader')
      .then(({ BrowserQRCodeReader }) => {
        if (!qrCodeReader.current) {
          qrCodeReader.current = new BrowserQRCodeReader();
        }

        qrCodeReader.current.getVideoInputDevices()
          .then(videoInputDevices => {
            setHasCamera(videoInputDevices.length > 0);
          });
      })
      .catch(console.error);

    return () => {
      if (qrCodeReader.current) {
        qrCodeReader.current.reset();
      }
    };
  }, []);

  useEffect(() => {
    if (activeScanQR) {
      if (qrCodeReader.current) {
        qrCodeReader.current.decodeFromInputVideoDevice(undefined, 'video').then(result => {
          onChangeActiveScanQR(false);

          parseQRResult(result.getText());
          if (qrCodeReader.current) {
            qrCodeReader.current.reset(); // release camera
          }
        })
          .catch((error) => {
            if (error) {
              alertUser(error.message || error);
            }
            onChangeActiveScanQR(false);
          });
      }
    }
  }, [activeScanQR, onChangeActiveScanQR, parseQRResult]);


  const handleSendToSelf = async (event: SyntheticEvent) => {
    if (!accountCode) {
      return;
    }
    try {
      const receiveAddresses = await getReceiveAddressList(accountCode)();
      if (receiveAddresses && receiveAddresses.length > 0 && receiveAddresses[0].addresses.length > 1) {
        onClickSendToSelfButton(event, receiveAddresses[0].addresses[0].address);
      }
    } catch (e) {
      console.error(e);
    }
  };


  const toggleScanQR = () => {
    if (activeScanQR) {
      if (qrCodeReader.current) {
        // release camera;
        qrCodeReader.current.reset();
      }
      onChangeActiveScanQR(false);
      return;
    }

    onChangeActiveScanQR(true);

  };

  return (
    <>
      <ScanQRDialog activeScanQR={activeScanQR} onToggleScanQR={toggleScanQR} />
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