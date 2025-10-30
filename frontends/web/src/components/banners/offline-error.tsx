/**
 * Copyright 2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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