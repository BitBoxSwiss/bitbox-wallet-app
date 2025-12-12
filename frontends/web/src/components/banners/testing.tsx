// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '@/contexts/AppContext';
import { Message } from '@/components/message/message';

export const Testing = () => {
  const { t } = useTranslation();
  const { isTesting } = useContext(AppContext);

  if (!isTesting) {
    return null;
  }

  return (
    <Message type="warning">
      {t('warning.testnet')}
    </Message>
  );
};
