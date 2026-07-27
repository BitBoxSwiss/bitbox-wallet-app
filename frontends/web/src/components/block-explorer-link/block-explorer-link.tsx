// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { A } from '@/components/anchor/anchor';
import { useConfig } from '@/contexts/ConfigProvider';
import { getMempoolExplorerUrl } from '@/utils/explorer-url';

type TProps = {
  children: ReactNode;
  className?: string;
  explorerId: string;
  prefix: string;
  title?: string;
};

export const BlockExplorerLink = ({
  children,
  className,
  explorerId,
  prefix,
  title,
}: TProps) => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const useOnion = config?.frontend.useOnionExplorerUrls ?? false;
  const href = getMempoolExplorerUrl(prefix, explorerId, useOnion);
  const linkTitle = title ?? `${t('transaction.explorerTitle')}\n${href}`;

  return (
    <A className={className} href={href} title={linkTitle}>
      {children}
    </A>
  );
};
