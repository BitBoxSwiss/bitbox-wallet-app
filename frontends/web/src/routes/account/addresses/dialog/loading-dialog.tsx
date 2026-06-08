// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/spinner/Spinner';
import { Dialog } from '@/components/dialog/dialog';
import style from '../addresses.module.css';

export const LoadingDialog = () => {
  const { t } = useTranslation();
  return (
    <Dialog open title={t('receive.verifyBitBox02')} medium centered>
      <div className={style.verifyDialogContent}>
        <Spinner text={t('loading')} />
      </div>
    </Dialog>
  );
};
