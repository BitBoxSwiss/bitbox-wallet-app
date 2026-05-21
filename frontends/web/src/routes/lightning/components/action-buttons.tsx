// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { connectKeystore } from '@/api/keystores';
import { getTopUpInfo } from '@/api/lightning';
import style from './action-buttons.module.css';

type TProps = {
  canSend?: boolean;
};

export const ActionButtons = ({ canSend }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleTopUpClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try {
      const topUpInfo = await getTopUpInfo();
      if (topUpInfo.success && topUpInfo.accountToConnectRootFingerprint) {
        const connectResult = await connectKeystore(topUpInfo.accountToConnectRootFingerprint);
        if (!connectResult.success) {
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch Lightning top-up info', err);
    }
    navigate('/lightning/top-up');
  };

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
      <Link key="topUp" to={'/lightning/top-up'} className={style.topUp} onClick={handleTopUpClick}>
        <span>{t('lightning.topUp.button')}</span>
      </Link>
    </div>
  );
};
