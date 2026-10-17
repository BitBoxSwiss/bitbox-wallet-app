// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDarkmode } from '@/hooks/darkmode';
import { readAppearance, saveAppearance, sidebarWidthLimits } from '@/utils/desktop-appearance';
import styles from './sidebar.module.css';

const currentWidth = () => parseFloat(document.body.style.getPropertyValue('--design-sidebar-width')) || sidebarWidthLimits.min;

export const SidebarResize = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const [width, setWidth] = useState(currentWidth);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    const changed = () => setWidth(currentWidth());
    window.addEventListener('bitbox-chrome-layout', changed);
    changed();
    return () => window.removeEventListener('bitbox-chrome-layout', changed);
  }, []);
  const resize = (value: number) => {
    const next = Math.round(Math.max(sidebarWidthLimits.min, Math.min(sidebarWidthLimits.max, value)));
    document.body.style.setProperty('--design-sidebar-width', `${next}px`);
    setWidth(next);
    return next;
  };
  const save = (value: number) => {
    const mode = isDarkMode ? 'dark' : 'light';
    setSaveFailed(!saveAppearance(mode, { ...readAppearance()[mode], sidebarWidth: value }));
    window.dispatchEvent(new Event('bitbox-appearance-saved'));
  };
  return (<div
    className={styles.resizeHandle}
    role="separator"
    tabIndex={0}
    aria-label={t('desktopDesign.resizeSidebar')}
    aria-orientation="vertical"
    aria-valuemin={sidebarWidthLimits.min}
    aria-valuemax={sidebarWidthLimits.max}
    aria-valuenow={width}
    title={t(saveFailed ? 'desktopDesign.saveFailed' : 'desktopDesign.resizeSidebar')}
    onPointerDown={event => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        resize(event.clientX - event.currentTarget.parentElement!.getBoundingClientRect().left);
      }
    }}
    onPointerUp={event => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        save(width);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }}
    onPointerCancel={() => save(width)}
    onKeyDown={event => {
      const next = { ArrowLeft: width - 10, ArrowRight: width + 10, Home: sidebarWidthLimits.min, End: sidebarWidthLimits.max }[event.key];
      if (next !== undefined) {
        event.preventDefault();
        save(resize(next));
      }
    }}
  />);
};
