// SPDX-License-Identifier: Apache-2.0

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

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${(runningInIOS() ? anchorStyle.linkIos : anchorStyle.link) || ''} ${styles.explorerLink || ''}`}
      title={`${t('transaction.explorerTitle')}\n${href}`}
      onClick={event => {
        event.preventDefault();
        open(href).then(response => {
          if (!response.success) {
            alertUser(response.errorMessage
              ? t('unknownError', { errorMessage: response.errorMessage })
              : t('genericError'));
          }
        }).catch(console.error);
      }}
      onContextMenu={event => {
        if (window.android?.showExplorerLinkMenu) {
          event.preventDefault();
          window.android.showExplorerLinkMenu(href);
        }
      }}>
      <ExternalLink />
      {' '}
      {t('transaction.explorerTitle')}
    </a>
  );
};
