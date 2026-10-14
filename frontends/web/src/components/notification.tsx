// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { syncNewTxs } from '@/api/transactions';
import { notifyUser } from '@/api/system';

export const AppNotifications = () => {
  const { t } = useTranslation();

  // transaction notification effect
  useEffect(() => {
    return syncNewTxs((meta) => {
      notifyUser(t('notification.newTxs', {
        count: meta.count,
        accountName: meta.accountName,
      }));
    });
  }, [t]);

  return null;
};
