// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Message } from '@/components/message/message';
import { Dialog } from '@/components/dialog/dialog';
import style from '../addresses.module.css';

type TProps = {
  onClose: () => void;
};

export const AddressNotFoundDialog = ({ onClose }: TProps) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      title={t('addresses.detail.address')}
      medium
      centered
      onClose={onClose}
    >
      <div className={style.verifyDialogContent}>
        <Message type="warning">{t('addresses.notFound')}</Message>
      </div>
    </Dialog>
  );
};
