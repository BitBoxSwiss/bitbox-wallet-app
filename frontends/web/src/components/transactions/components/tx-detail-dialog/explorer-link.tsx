// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@/api/system';
import { alertUser } from '@/components/alert/Alert';
import { ExternalLink } from '@/components/icon';
import { runningInIOS } from '@/utils/env';
import anchorStyle from '@/components/anchor/anchor.module.css';
import styles from './tx-detail-dialog.module.css';

type TProps = {
  href: string;
};

export const ExplorerLink = ({ href }: TProps) => {
  const { t } = useTranslation();
  const isIOS = runningInIOS();
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchStart = useRef<{ x: number; y: number }>();
  const menuShown = useRef(false);

  const cancelHold = () => {
    clearTimeout(holdTimer.current);
    touchStart.current = undefined;
  };

  useEffect(() => () => clearTimeout(holdTimer.current), [href]);

  const showIOSMenu = () => {
    cancelHold();
    menuShown.current = true;
    window.webkit?.messageHandlers.showExplorerLinkMenu?.postMessage({
      url: href,
      copy: t('button.copy'),
      open: t('button.openInBrowser'),
      cancel: t('dialog.cancel'),
    });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${(isIOS ? anchorStyle.linkIos : anchorStyle.link) || ''} ${styles.explorerLink || ''}`}
      // A native link preview can contact the explorer before the user chooses Copy.
      style={isIOS ? { WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } : undefined}
      title={`${t('transaction.explorerTitle')}\n${href}`}
      onPointerDown={() => {
        menuShown.current = false;
      }}
      onTouchStart={event => {
        cancelHold();
        menuShown.current = false;
        const touch = event.touches[0];
        if (isIOS && event.touches.length === 1 && touch) {
          touchStart.current = { x: touch.clientX, y: touch.clientY };
          holdTimer.current = setTimeout(showIOSMenu, 500);
        }
      }}
      onTouchMove={event => {
        const touch = event.touches[0];
        const start = touchStart.current;
        if (event.touches.length !== 1 || !touch || (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10)) {
          cancelHold();
        }
      }}
      onTouchEnd={event => {
        cancelHold();
        if (menuShown.current) {
          event.preventDefault();
        }
      }}
      onTouchCancel={cancelHold}
      onClick={event => {
        event.preventDefault();
        if (menuShown.current && event.detail !== 0) {
          menuShown.current = false;
          return;
        }
        open(href).then(response => {
          if (!response.success) {
            alertUser(response.errorMessage
              ? t('unknownError', { errorMessage: response.errorMessage })
              : t('genericError'));
          }
        }).catch(console.error);
      }}
      onContextMenu={event => {
        if (isIOS) {
          event.preventDefault();
          showIOSMenu();
        } else if (window.android?.showExplorerLinkMenu) {
          event.preventDefault();
          window.android.showExplorerLinkMenu({
            url: href,
            copy: t('button.copy'),
            open: t('button.openInBrowser'),
            openError: t('transaction.explorerError'),
          });
        }
      }}>
      <ExternalLink />
      {' '}
      {t('transaction.explorerTitle')}
    </a>
  );
};
