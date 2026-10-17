// SPDX-License-Identifier: Apache-2.0

import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useDarkmode } from '@/hooks/darkmode';
import { applyAppearance, readAppearance } from '@/utils/desktop-appearance';
import { attachDesktopGeometry, desktopChromeState, desktopModernized, desktopSystemDark, initializeDesktopChrome, notifyChromeLayout, subscribeDesktopChrome } from '@/utils/desktop-chrome';

function useDesktopSnapshot<T>(getSnapshot: () => T) {
  const state = useSyncExternalStore(subscribeDesktopChrome, getSnapshot);
  useEffect(() => {
    initializeDesktopChrome();
  }, []);
  return state;
}

export const useDesktopChrome = () => useDesktopSnapshot(desktopChromeState);
// Layout and theme consumers must not rerender for native geometry/focus changes.
export const useDesktopModernized = () => useDesktopSnapshot(desktopModernized);
export const useDesktopSystemDark = () => useDesktopSnapshot(desktopSystemDark);

export const DesktopChrome = () => {
  const state = useDesktopChrome();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { isDarkMode } = useDarkmode();
  const ready = state !== undefined;
  useEffect(() => {
    if (ready) {
      const mode = isDarkMode ? 'dark' : 'light';
      applyAppearance(readAppearance()[mode], mode);
    }
  }, [ready, isDarkMode]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    return attachDesktopGeometry({
      minimize: t('desktopChrome.minimize'),
      maximize: t('desktopChrome.maximize'),
      close: t('desktopChrome.close'),
    });
  }, [ready, t]);

  useEffect(() => {
    notifyChromeLayout();
  }, [pathname, isDarkMode]);
  return null;
};
