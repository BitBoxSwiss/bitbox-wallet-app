// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '@/contexts/AppContext';
import { SessionStatus } from '@/components/status/status-session';

export const Testing = () => {
  const { t } = useTranslation();
  const { isTesting } = useContext(AppContext);

  if (!isTesting) {
    return null;
  }

  return (
    <SessionStatus
      type="warning"
      dismissible="omg">
      {t('warning.testnet')}
    </SessionStatus>
  );
};
