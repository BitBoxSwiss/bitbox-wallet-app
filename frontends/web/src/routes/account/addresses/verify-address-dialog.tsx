// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { CoinCode } from '@/api/account';
import { TUsedAddress } from '@/api/account';
import { Spinner } from '@/components/spinner/Spinner';
import { Message } from '@/components/message/message';
import { Dialog } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { WarningOutlined } from '@/components/icon';
import { getAddressURIPrefix } from '@/routes/account/utils';
import { VerifyAddressDialogContent } from '../components/verify-address-dialog-content';
import { TUseAddressVerificationResult } from '../components/use-address-verification';
import style from './addresses.module.css';

type TProps = {
  verification: TUseAddressVerificationResult;
  selectedAddress: TUsedAddress | null;
  isLoading: boolean;
  coinCode?: CoinCode;
  onClose: (addressID?: string) => void;
};

const AddressNotFound = () => {
  const { t } = useTranslation();
  return (
    <div>
      <Message type="warning">{t('addresses.notFound')}</Message>
      <div className="hide-on-small">
        <BackButton enableEsc>
          {t('button.back')}
        </BackButton>
      </div>
    </div>
  );
};

const LoadingDialog = () => {
  const { t } = useTranslation();
  return (
    <Dialog open title={t('receive.verifyBitBox02')} medium centered>
      <div className={style.verifyDialogContent}>
        <Spinner text={t('loading')} />
      </div>
    </Dialog>
  );
};

const SkipWarningDialog = ({ verification, selectedAddress, onClose }: Pick<TProps, 'verification' | 'selectedAddress' | 'onClose'>) => {
  const { t } = useTranslation();
  return (
    <Dialog open title={t('addresses.skipVerifyTitle')} medium onClose={() => onClose(selectedAddress?.addressID)}>
      <div className={[style.verifyDialogContent, style.verifySkipDialogContent].join(' ')}>
        <div className={style.warningRow}>
          <WarningOutlined className={style.warningIcon} />
          <span>{t('addresses.skipVerifyWarning')}</span>
        </div>

        <p className={style.sheetBody}>{t('addresses.skipVerifyBody')}</p>
        <p className={style.sheetBody}>{t('addresses.skipVerifyQuestion')}</p>

        <div className={style.verifyDialogActions}>
          <Button secondary className={style.skipVerifyConfirmButton} onClick={verification.skipVerify}>
            {t('addresses.skipVerifyConfirm')}
          </Button>
          <Button secondary onClick={() => onClose(selectedAddress?.addressID)}>
            {t('dialog.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

const SkippedDialog = ({ selectedAddress, coinCode, onClose }: Pick<TProps, 'selectedAddress' | 'coinCode' | 'onClose'>) => {
  const { t } = useTranslation();
  if (!selectedAddress) {
    return <AddressNotFound />;
  }
  return (
    <Dialog
      open
      title={t('addresses.detail.address')}
      medium
      centered
      onClose={() => onClose(selectedAddress.addressID)}
    >
      <div className={style.verifyDialogContent}>
        <VerifyAddressDialogContent
          address={selectedAddress.address}
          uriPrefix={getAddressURIPrefix(coinCode)}
          instructionClassName={style.verifyDialogInstruction}
          qrWrapClassName={style.qrWrap}
          qrSize={180}
        />
        <div className={style.skipFinalWarning}>
          <p className={style.skipFinalWarningText}>
            {t('addresses.skipVerifyWarning')}. {t('addresses.unverifiedAddressWarning')}
          </p>
        </div>
      </div>
    </Dialog>
  );
};

const VerifyOnDeviceDialog = ({ verification, selectedAddress, coinCode, onClose }: Pick<TProps, 'verification' | 'selectedAddress' | 'coinCode' | 'onClose'>) => {
  const { t } = useTranslation();
  if (!selectedAddress) {
    return <AddressNotFound />;
  }
  const isError = verification.verifyState === 'error';
  return (
    <Dialog
      open
      title={t('receive.verifyBitBox02')}
      medium
      centered
      onClose={isError ? () => onClose(selectedAddress.addressID) : undefined}
    >
      <div className={style.verifyDialogContent}>
        <VerifyAddressDialogContent
          address={selectedAddress.address}
          uriPrefix={getAddressURIPrefix(coinCode)}
          instruction={t('receive.verifyInstruction')}
          instructionClassName={style.verifyDialogInstruction}
          qrWrapClassName={style.qrWrap}
          qrSize={180}
        />
        {isError && (
          <div className={style.verifyDialogError}>
            <Message type="error">{verification.verifyError || t('addresses.verifyFailed')}</Message>
            <div className={style.footerButtons}>
              <Button secondary onClick={verification.retryVerify}>
                {t('generic.retry')}
              </Button>
              <Button secondary onClick={() => onClose(selectedAddress.addressID)}>
                {t('button.back')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

const ConnectFailedDialog = ({ verification, selectedAddress, onClose }: Pick<TProps, 'verification' | 'selectedAddress' | 'onClose'>) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      title={t('receive.verifyBitBox02')}
      medium
      centered
      onClose={() => onClose(selectedAddress?.addressID)}
    >
      <div className={style.verifyDialogContent}>
        <Message type="error">{verification.verifyError || t('addresses.verifyConnectFailed')}</Message>
        <div className={style.footerButtons}>
          <Button primary onClick={verification.retryVerify}>
            {t('generic.retry')}
          </Button>
          <Button secondary onClick={() => onClose(selectedAddress?.addressID)}>
            {t('button.back')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export const VerifyAddressDialog = ({ verification, selectedAddress, isLoading, coinCode, onClose }: TProps) => {
  const { verifyState, hasSkipDeviceVerificationQuery } = verification;

  const isSkipWarning = verifyState === 'skipWarning' || hasSkipDeviceVerificationQuery;
  const isSkipped = verifyState === 'skipped';

  if (isSkipWarning || isSkipped) {
    if (isSkipped) {
      if (isLoading) {
        return <LoadingDialog />;
      }
      return <SkippedDialog selectedAddress={selectedAddress} coinCode={coinCode} onClose={onClose} />;
    }
    return <SkipWarningDialog verification={verification} selectedAddress={selectedAddress} onClose={onClose} />;
  }

  if (verifyState === 'connectFailed') {
    return <ConnectFailedDialog verification={verification} selectedAddress={selectedAddress} onClose={onClose} />;
  }

  if (verifyState === 'verifying' || verifyState === 'error') {
    if (isLoading) {
      return <LoadingDialog />;
    }
    return <VerifyOnDeviceDialog verification={verification} selectedAddress={selectedAddress} coinCode={coinCode} onClose={onClose} />;
  }

  return null;
};
