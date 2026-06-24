// SPDX-License-Identifier: Apache-2.0

import { ReactNode, SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { openExplorerUrls } from '@/api/system';
import { A } from '@/components/anchor/anchor';
import style from '@/components/anchor/anchor.module.css';
import { alertUser } from '@/components/alert/Alert';
import { useConfig } from '@/contexts/ConfigProvider';
import { runningInAndroid, runningInIOS } from '@/utils/env';
import { getMempoolExplorerUrls } from '@/utils/explorer-url';

type TProps = {
  children: ReactNode;
  className?: string;
  id: string;
  prefix: string;
  title?: string;
};

export const BlockExplorerLink = ({
  children,
  className,
  id,
  prefix,
  title,
}: TProps) => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const useOnion = config?.frontend.useOnionExplorerUrls ?? false;
  const { href, clearnetHref } = getMempoolExplorerUrls(prefix, id, useOnion);
  const linkTitle = title ?? `${t('transaction.explorerTitle')}\n${href}`;
  const useAndroidChooser = runningInAndroid() && useOnion && href !== clearnetHref;

  if (useAndroidChooser) {
    return (
      <span
        className={`
          ${(runningInIOS() ? style.linkIos : style.link) || ''}
          ${className || ''}
        `}
        title={linkTitle}
        onClick={(e: SyntheticEvent) => {
          e.preventDefault();
          openExplorerUrls(href, clearnetHref)
            .then(response => {
              if (!response.success) {
                alertUser(response.errorMessage
                  ? t('unknownError', { errorMessage: response.errorMessage })
                  : t('genericError'));
              }
            })
            .catch(console.error);
        }}
        tabIndex={0}>
        {children}
      </span>
    );
  }

  return (
    <A className={className} href={href} title={linkTitle}>
      {children}
    </A>
  );
};
