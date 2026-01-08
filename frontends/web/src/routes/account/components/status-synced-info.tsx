// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, TStatus } from '@/api/account';
import { syncAddressesCount } from '@/api/accountsync';
import { useSubscribe } from '@/hooks/api';

type TProps = {
  code: AccountCode;
  status: TStatus | undefined;
};

export const StatusSyncedInfo = ({
  code,
  status,
}: TProps) => {
  const { t } = useTranslation();

  const syncedAddressesCount = useSubscribe(syncAddressesCount(code));

  const isNotSynced = (
    status !== undefined
    && !status.synced
    && syncedAddressesCount !== undefined
    && syncedAddressesCount > 1
  );

  const notSyncedText = (
    isNotSynced
      ? t('account.syncedAddressesCount', {
        count: syncedAddressesCount,
      })
      : ''
  );

  return (
    <>
      {notSyncedText}
    </>
  );
};
