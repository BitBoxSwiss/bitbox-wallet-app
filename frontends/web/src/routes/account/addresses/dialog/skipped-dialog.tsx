// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/dialog/dialog';
import { getAddressURIPrefix } from '@/routes/account/utils';
import { VerifyAddressDialogContent } from '../../components/verify-address-dialog-content';
import { AddressNotFoundDialog } from './address-not-found-dialog';
import { TDialogProps } from './types';
import style from '../addresses.module.css';

export const SkippedDialog = ({ selectedAddress, coinCode, onClose }: Pick<TDialogProps, 'selectedAddress' | 'coinCode' | 'onClose'>) => {
  const { t } = useTranslation();
  if (!selectedAddress) {
    return <AddressNotFoundDialog onClose={() => onClose()} />;
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
