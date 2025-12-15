// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Message } from '@/components/message/message';
import { AppContext } from '@/contexts/AppContext';
import { useContext } from 'react';

export const Offline = () => {
  const { t } = useTranslation();
  const { isOnline } = useContext(AppContext);

  if (isOnline === undefined) {
    return null;
  }

  return (
    <Message type="warning" hidden={isOnline}>
      {t('warning.offline')}
    </Message>
  );
};
