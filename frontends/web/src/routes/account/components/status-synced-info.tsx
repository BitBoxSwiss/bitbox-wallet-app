// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, TStatus } from '@/api/account';
import { getStatus } from '@/api/account';
import { statusChanged, syncAddressesCount } from '@/api/accountsync';
import { useSubscribe, useSync } from '@/hooks/api';

type TProps = {
  code: AccountCode;
};

export const StatusSyncedInfo = ({
  code,
}: TProps) => {
  const { t } = useTranslation();

  const syncedAddressesCount = useSubscribe(syncAddressesCount(code));

  const status: TStatus | undefined = useSync(
    () => getStatus(code),
    cb => statusChanged(code, cb),
  );

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
