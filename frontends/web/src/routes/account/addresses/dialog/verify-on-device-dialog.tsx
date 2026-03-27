// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Message } from '@/components/message/message';
import { Dialog } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { getAddressURIPrefix } from '@/routes/account/utils';
import { VerifyAddressDialogContent } from '../../components/verify-address-dialog-content';
import { AddressNotFoundDialog } from './address-not-found-dialog';
import { TDialogProps } from './types';
import style from '../addresses.module.css';

export const VerifyOnDeviceDialog = ({ verification, selectedAddress, coinCode, onClose }: Pick<TDialogProps, 'verification' | 'selectedAddress' | 'coinCode' | 'onClose'>) => {
  const { t } = useTranslation();
  if (!selectedAddress) {
    return <AddressNotFoundDialog onClose={() => onClose()} />;
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
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
