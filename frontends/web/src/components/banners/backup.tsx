/**
 * Copyright 2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Status } from '@/components/status/status';
import { MultilineMarkup } from '@/utils/markup';
import { TKeystore } from '@/api/account';
import { AppContext } from '@/contexts/AppContext';
import { getShowBackupBanner, TShowBackupBannerResponse } from '@/api/backupBanner';
import { useContext, useEffect, useState } from 'react';

type BackupReminderProps = {
  keystore: TKeystore;
  deviceID: string;
  trigger: number;
}

export const BackupReminder = ({ keystore, deviceID, trigger }: BackupReminderProps) => {
  const { t } = useTranslation();
  const [bannerResponse, setBannerResponse] = useState<TShowBackupBannerResponse|null>(null);
  const { hideAmounts } = useContext(AppContext);

  useEffect(() => {
    getShowBackupBanner(keystore.rootFingerprint).then(setBannerResponse);
  }, [keystore.rootFingerprint, trigger]);


  if (hideAmounts) {
    // If amounts are hidden, we don't show the backup reminder.
    return;
  }

  if (!bannerResponse || !bannerResponse.success) {
    return null;
  }

  const deviceSettingsURL = `/settings/device-settings/${deviceID}`;

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
            link: deviceSettingsURL
          })}
      />
      {keystore.connected ? (
        <Link to={deviceSettingsURL}>{t('account.backupReminderLink')}</Link>
      ) : (
        <>
          {t('connectKeystore.promptWithNameForBackup',
            {
              name: keystore.name
            })}
        </>
      )
      }
    </Status>
  );
};
