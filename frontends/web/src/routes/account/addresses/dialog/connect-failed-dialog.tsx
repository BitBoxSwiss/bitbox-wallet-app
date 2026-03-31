// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Message } from '@/components/message/message';
import { Dialog } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { TDialogProps } from './types';
import style from '../addresses.module.css';

export const ConnectFailedDialog = ({ verification, selectedAddress, onClose }: Pick<TDialogProps, 'verification' | 'selectedAddress' | 'onClose'>) => {
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
        </div>
      </div>
    </Dialog>
  );
};
