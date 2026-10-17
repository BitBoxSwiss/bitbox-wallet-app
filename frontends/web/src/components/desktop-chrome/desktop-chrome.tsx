// SPDX-License-Identifier: Apache-2.0

import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useDarkmode } from '@/hooks/darkmode';
import { useConfig } from '@/contexts/ConfigProvider';
import { attachDesktopGeometry, desktopChromeState, desktopModernized, desktopSystemDark, initializeDesktopChrome, notifyChromeLayout, prepareDesktopStartup, subscribeDesktopChrome } from '@/utils/desktop-chrome';

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
  const { config } = useConfig();
  const ready = state !== undefined;
  const themeReady = config !== undefined && (config.frontend.darkmode !== undefined || state?.systemAppearanceReady === true);
  const preferredDark = config?.frontend.darkmode ?? state?.systemDark;
  const documentId = state?.document;
  const startupReady = state?.startupReady !== false;

  useEffect(() => {
    if (!ready || !themeReady || isDarkMode !== preferredDark) {
      return;
    }
    let disposed = false;
    let frame: number | undefined;
    document.fonts.ready.then(() => {
      if (!disposed) {
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(prepareDesktopStartup);
        });
      }
    });
    return () => {
      disposed = true;
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }, [ready, themeReady, documentId, startupReady, isDarkMode, preferredDark]);

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
