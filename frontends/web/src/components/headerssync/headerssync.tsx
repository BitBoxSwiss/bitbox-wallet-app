// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMountedRef } from '@/hooks/mount';
import { CoinCode } from '@/api/account';
import { subscribeCoinHeaders } from '@/api/coins';
import { useSubscribe } from '@/hooks/api';
import { AsciiSpinner } from '@/components/spinner/ascii';
import style from './headerssync.module.css';

export type TProps = {
  coinCode: CoinCode;
};

export const HeadersSync = ({ coinCode }: TProps) => {
  const { i18n, t } = useTranslation();
  const status = useSubscribe(subscribeCoinHeaders(coinCode));
  const [hidden, setHidden] = useState<boolean>(false);
  const mounted = useMountedRef();

  useEffect(() => {
    if (mounted.current && status && (status.tip === status.targetHeight)) {
      setTimeout(() => setHidden(true), 4000);
    }
  }, [mounted, status]);

  if (!status || hidden) {
    return null;
  }

  const total = status.targetHeight - status.tipAtInitTime;
  const value = 100 * (status.tip - status.tipAtInitTime) / total;
  const loaded = !total || value >= 100;
  const formatted = new Intl.NumberFormat(i18n.language).format(status.tip);

  return (
    <div className={style.syncContainer}>
      <div className={style.syncMessage}>
        <div className={style.syncText}>
          {t('headerssync.blocksSynced', { blocks: formatted })}
          {' '}
          { !loaded && `(${Math.ceil(value)}%)` }
        </div>
        { !loaded ? (<AsciiSpinner />) : null }
      </div>
      <div data-testid="progress-bar" className={style.progressBar}>
        <div className={style.progressValue} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
};
