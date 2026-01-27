// SPDX-License-Identifier: Apache-2.0

import { call } from '@/utils/transport-qt';
import { runningInQtWebEngine } from '@/utils/env';
import styles from './titlebar.module.css';

const callWindowControl = (action: string) => {
  if (!runningInQtWebEngine()) {
    return;
  }
  // Use the existing Qt transport to call window control methods
  call(JSON.stringify({ action }));
};

const handleMinimize = () => {
  callWindowControl('windowMinimize');
};

const handleMaximize = () => {
  callWindowControl('windowMaximize');
};

const handleClose = () => {
  callWindowControl('windowClose');
};

const handleStartDrag = (e: React.MouseEvent) => {
  // Only start drag if clicking directly on the title bar, not on buttons
  if ((e.target as HTMLElement).closest('button')) {
    return;
  }
  callWindowControl('windowStartDrag');
};

const handleDoubleClick = (e: React.MouseEvent) => {
  // Toggle maximize on double-click (not on buttons)
  if ((e.target as HTMLElement).closest('button')) {
    return;
  }
  callWindowControl('windowMaximize');
};

type TitleBarProps = {
  show: boolean;
};

export const TitleBar = ({ show }: TitleBarProps) => {
  if (!show) {
    return null;
  }

  return (
    <div
      className={styles.titleBar}
      onMouseDown={handleStartDrag}
      onDoubleClick={handleDoubleClick}
    >
      {/* Dark section above sidebar */}
      <div className={styles.sidebarSection} />

      {/* Content section with theme-based background */}
      <div className={styles.contentSection}>
        {/* Window controls - hidden on macOS (uses native traffic lights) */}
        <div className={styles.windowControls}>
          <button
            type="button"
            className={`${styles.controlButton || ''} ${styles.minimizeButton || ''}`}
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <svg viewBox="0 0 12 12" className={styles.controlIcon}>
              <line x1="2" y1="6" x2="10" y2="6" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.controlButton || ''} ${styles.maximizeButton || ''}`}
            onClick={handleMaximize}
            aria-label="Maximize"
          >
            <svg viewBox="0 0 12 12" className={styles.controlIcon}>
              <rect x="2" y="2" width="8" height="8" fill="none" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.controlButton || ''} ${styles.closeButton || ''}`}
            onClick={handleClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 12 12" className={styles.controlIcon}>
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Blue section above guide - appears when guide is open */}
      <div className={styles.guideSection} />
    </div>
  );
};
