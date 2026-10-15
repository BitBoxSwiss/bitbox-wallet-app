// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { runningInQtWebEngine } from '@/utils/env';
import { useDesktopChrome } from './desktop-chrome';
import style from './desktop-startup.module.css';

type TProps = {
  children: ReactNode;
};

export const DesktopStartup = ({ children }: TProps) => {
  const state = useDesktopChrome();
  const { t } = useTranslation();
  const linuxDesktop = runningInQtWebEngine() && navigator.userAgent.toLowerCase().includes('linux');
  if (!linuxDesktop || (state && (!state.csd || state.startupReady !== false))) {
    return <>{children}</>;
  }

  return (
    <div className={`app ${style.loading || ''}`} role="status" aria-busy="true">
      <div className={style.caption} data-window-titlebar data-window-frame-surface />
      <div className={style.indicator}>
        <SpinnerRingAnimated />
        <p>{t('loading')}</p>
      </div>
    </div>
  );
};
