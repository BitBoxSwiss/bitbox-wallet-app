// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/spinner/Spinner';

export const SendingSpinner = () => {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string>(t('lightning.send.sending.connecting'));

  useEffect(() => {
    setMessage(t('lightning.send.sending.connecting'));
    const timeout = window.setTimeout(() => {
      setMessage(t('lightning.send.sending.message'));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [t]);

  return <Spinner text={message} />;
};
