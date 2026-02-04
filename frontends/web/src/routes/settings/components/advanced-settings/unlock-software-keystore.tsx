// SPDX-License-Identifier: Apache-2.0

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
        icon={
          <Eject
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
        icon={
          <ChevronRightDark />
        }
      />
    </SkipForTesting>
  );
};
