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
import { useDefault } from '@/hooks/default';
import { useLoad } from '@/hooks/api';
import { useKeystores } from '@/hooks/backend';
import { getTesting } from '@/api/backend';
import { deregisterTest } from '@/api/keystores';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { SkipForTesting } from '@/routes/device/components/skipfortesting';
import { ChevronRightDark, Eject } from '@/components/icon';
import styles from './unlock-software-keystore.module.css';

type TProps = {
  deviceIDs: string[];
};

export const UnlockSoftwareKeystore = ({
  deviceIDs,
}: TProps) => {
  const { t } = useTranslation();
  const isTesting = useDefault(useLoad(getTesting), false);
  const keystores = useKeystores();

  if (!isTesting || deviceIDs.length) {
    return null;
  }
  if (keystores?.some(({ type }) => type === 'software')) {
    return (
      <SettingsItem
        settingName={t('testWallet.disconnect.title')}
        secondaryText={t('testWallet.disconnect.description')}
        onClick={() => deregisterTest()}
        hideChevron
        extraComponent={
          <Eject
            className={styles.ejectIconRight}
            width={18}
            height={18}
            alt={t('sidebar.leave')}
          />
        }
      />
    );
  }
  return (
    <SkipForTesting className={styles.settingsItemButton}>
      <SettingsItem
        settingName={t('testWallet.connect.title')}
        secondaryText={t('testWallet.connect.description')}
        extraComponent={
          <ChevronRightDark
            className={styles.chevronRight}
            width={24}
            height={24}
          />
        }
      />
    </SkipForTesting>
  );
};
