// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { useConfig } from '@/contexts/ConfigProvider';
import { useDarkmode } from '@/hooks/darkmode';
import { runningInQtWebEngine } from '@/utils/env';
import { useDesktopChrome } from './desktop-chrome';
import style from './desktop-startup.module.css';

type TProps = {
  children: ReactNode;
};

export const DesktopStartup = ({ children }: TProps) => {
  const state = useDesktopChrome();
  const { t } = useTranslation();
  const { config } = useConfig();
  const { isDarkMode } = useDarkmode();
  const themeReady = (config !== undefined && (config.frontend.darkmode !== undefined || state?.systemAppearanceReady === true) &&
    isDarkMode === (config.frontend.darkmode ?? state?.systemDark));
  const [started, setStarted] = useState(themeReady);
  useEffect(() => {
    if (themeReady) {
      setStarted(true);
    }
  }, [themeReady]);
  const linuxDesktop = runningInQtWebEngine() && navigator.userAgent.toLowerCase().includes('linux');
  if (!linuxDesktop || (state && (!state.csd || started))) {
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
