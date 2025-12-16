// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../message/message';
import { getConfig } from '@/utils/config';
import style from './offline-errors.module.css';

type Props = {
  error?: string | null;
};

export const OfflineError = ({
  error,
}: Props) => {

  const { t } = useTranslation();
  const [usesProxy, setUsesProxy] = useState<boolean>();

  useEffect(() => {
    getConfig().then(({ backend }) => setUsesProxy(backend.proxy.useProxy));
  }, []);

  // Status: offline error
  const offlineErrorTextLines: string[] = [];
  if (error) {
    offlineErrorTextLines.push(t('account.reconnecting')); // Lost connection, trying to reconnect…
    offlineErrorTextLines.push(error);
    if (usesProxy) {
      offlineErrorTextLines.push(t('account.maybeProxyError'));
    }
  }

  if (!error) {
    return null;
  }

  return (
    <Message type="error" className={style.status}>
      {offlineErrorTextLines.join('\n')}
    </Message>
  );
};