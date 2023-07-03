import { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../../../components/forms';
import qrcodeIconDark from '../../../../../assets/icons/qrcode-dark.png';
import qrcodeIconLight from '../../../../../assets/icons/qrcode-light.png';

import style from '../../send.module.css';

type TToggleScanQRButtonProps = {
    onClick: () => void;
}

type TReceiverAddressInputProps = {
    onClickScanQRButton: () => void;
    hasCamera: boolean;
    debug: boolean;
    onClickSendToSelfButton: (e: SyntheticEvent) => void;
    onInputChange: (e: SyntheticEvent) => void;
    addressError?: string;
    recipientAddress: string;
}

const ScanQRButton = ({ onClick }: TToggleScanQRButtonProps) => {
  return (
    <button onClick={onClick} className={style.qrButton}>
      <img className="show-in-lightmode" src={qrcodeIconDark} />
      <img className="show-in-darkmode" src={qrcodeIconLight} />
    </button>);
};

export const ReceiverAddressInput = ({
  onClickScanQRButton,
  hasCamera,
  debug,
  onInputChange,
  onClickSendToSelfButton,
  addressError,
  recipientAddress
}: TReceiverAddressInputProps) => {
  const { t } = useTranslation();
  return (
    <Input
      label={t('send.address.label')}
      placeholder={t('send.address.placeholder')}
      id="recipientAddress"
      error={addressError}
      onInput={onInputChange}
      value={recipientAddress}
      className={hasCamera ? style.inputWithIcon : ''}
      labelSection={debug ? (
        <span id="sendToSelf" className={style.action} onClick={onClickSendToSelfButton}>
        Send to self
        </span>
      ) : undefined}
      autoFocus>
      { hasCamera && (
        <ScanQRButton onClick={onClickScanQRButton} />
      )}
    </Input>
  );
};