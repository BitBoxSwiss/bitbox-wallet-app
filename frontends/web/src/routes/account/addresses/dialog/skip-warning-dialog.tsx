// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { WarningOutlined } from '@/components/icon';
import { TDialogProps } from './types';
import style from '../addresses.module.css';

export const SkipWarningDialog = ({ verification, selectedAddress, onClose }: Pick<TDialogProps, 'verification' | 'selectedAddress' | 'onClose'>) => {
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
        </div>
      </div>
    </Dialog>
  );
};
