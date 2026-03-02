// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import style from './action-buttons.module.css';

type TProps = {
  canSend?: boolean;
};

export const ActionButtons = ({ canSend }: TProps) => {
  const { t } = useTranslation();
  return (
    <div className={style.actionsContainer}>
      {canSend ? (
        <Link key="sendLink" to={'/lightning/send'} className={style.send}>
          <span>{t('generic.send')}</span>
        </Link>
      ) : (
        <span key="sendDisabled" className={[style.send || '', style.disabled || ''].join(' ').trim()}>
          {t('generic.send')}
        </span>
      )}
      <Link key="receive" to={'/lightning/receive'} className={style.receive}>
        <span>{t('generic.receiveWithoutCoinCode')}</span>
      </Link>
    </div>
  );
};
