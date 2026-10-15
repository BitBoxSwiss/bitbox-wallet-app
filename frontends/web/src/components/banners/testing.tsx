// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { AppContext } from '@/contexts/AppContext';
import { SessionStatus } from '@/components/status/status-session';
import { isLightningRoute } from '@/utils/route';

export const Testing = () => {
  const { t } = useTranslation();
  const { isTesting } = useContext(AppContext);
  const { pathname } = useLocation();

  if (!isTesting || isLightningRoute(pathname)) {
    return null;
  }

  return (
    <SessionStatus
      type="warning"
      dismissibleKey="skipTestingWarning">
      {t('warning.testnet')}
    </SessionStatus>
  );
};
