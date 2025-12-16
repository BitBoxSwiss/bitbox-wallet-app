// SPDX-License-Identifier: Apache-2.0

import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeviceList } from '@/api/devices';
import { Link, useNavigate } from 'react-router-dom';
import { connectKeystore } from '@/api/keystores';
import { Status } from '@/components/status/status';
import { MultilineMarkup } from '@/utils/markup';
import { TKeystore } from '@/api/account';
import { AppContext } from '@/contexts/AppContext';
import { getShowBackupBanner, TShowBackupBannerResponse } from '@/api/backupBanner';
import { useContext, useEffect, useState } from 'react';
import { TAccountsBalanceSummary } from '@/api/account';
import { formatLocalizedAmount } from '@/components/amount/amount';
import { LocalizationContext } from '@/contexts/localization-context';

type BackupReminderProps = {
  keystore: TKeystore;
  accountsBalanceSummary?: TAccountsBalanceSummary;
};

export const BackupReminder = ({ keystore, accountsBalanceSummary }: BackupReminderProps) => {
  const { t } = useTranslation();
  const [bannerResponse, setBannerResponse] = useState<TShowBackupBannerResponse | null>(null);
  const { hideAmounts } = useContext(AppContext);
  const navigate = useNavigate();
  const { decimal, group } = useContext(LocalizationContext);

  useEffect(() => {
    getShowBackupBanner(keystore.rootFingerprint).then(setBannerResponse);
  }, [keystore.rootFingerprint, accountsBalanceSummary]);

  if (hideAmounts) {
    // If amounts are hidden, we don't show the backup reminder.
    return null;
  }

  if (!bannerResponse || !bannerResponse.success) {
    return null;
  }

  const maybeNavigateToSettings = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const connectResult = await connectKeystore(keystore.rootFingerprint);
    if (connectResult.success) {
      const devices = await getDeviceList();
      const firstDevice = Object.keys(devices)[0];
      if (!firstDevice) {
        // If no devices are connected, we cannot navigate to settings.
        // This shouldn't happen in theory, as the connectKeystore functions has succeeded.
        return;
      }
      const deviceSettingsURL = `/settings/device-settings/recovery-words/${firstDevice}`;
      // Proceed to the setting screen if the keystore was connected.
      navigate(deviceSettingsURL);
    }
  };

  return (
    <Status
      type="info"
      hidden={!bannerResponse.show}
      dismissible={`banner-backup-${keystore.rootFingerprint}`}>
      <MultilineMarkup
        tagName="span"
        withBreaks
        markup={t('account.backupReminder',
          {
            name: keystore.name,
            fiat: bannerResponse.fiat,
            threshold: formatLocalizedAmount(bannerResponse.threshold, group, decimal),
          })}
      />
      <Link to="#" onClick={maybeNavigateToSettings} >{t('account.backupReminderLink')} </Link>
    </Status>
  );
};
