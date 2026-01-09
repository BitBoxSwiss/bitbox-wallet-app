// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { AccountCode, TStatus } from '@/api/account';
import { getStatus } from '@/api/account';
import { statusChanged, syncAddressesCount } from '@/api/accountsync';
import { useSubscribe, useSync } from '@/hooks/api';
import { Warning } from '@/components/icon/icon';
import style from './status-synced-info.module.css';

type TProps = {
  code: AccountCode;
  withOfflineWarningIcon?: boolean;
};

export const StatusSyncedInfo = ({
  code,
  withOfflineWarningIcon,
}: TProps) => {
  const { t } = useTranslation();

  const syncedAddressesCount = useSubscribe(syncAddressesCount(code));

  const status: TStatus | undefined = useSync(
    () => getStatus(code),
    cb => statusChanged(code, cb),
  );

  const isSynced = status?.synced;

  const isScanningAddresses = (
    !isSynced
    && syncedAddressesCount !== undefined
    && syncedAddressesCount > 1
  );

  if (status?.offlineError) {
    return (
      <span className={style.offlineWarning}>
        {withOfflineWarningIcon && (<Warning />)}
        {status.offlineError}
      </span>
    );
  }

  if (isScanningAddresses) {
    return (
      t('account.syncedAddressesCount', {
        count: syncedAddressesCount,
      })
    );
  }

  return (
    t('account.scanning')
  );
};
