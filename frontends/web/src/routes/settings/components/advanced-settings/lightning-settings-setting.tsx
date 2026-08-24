// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/badge/badge';
import { useLightning } from '@/hooks/lightning';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import styles from './lightning-settings-setting.module.css';

export const LightningSettingsSetting = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { lightningAccount } = useLightning();

  if (lightningAccount === undefined) {
    return null;
  }

  const isLightningEnabled = lightningAccount !== null;

  return (
    <SettingsItem
      settingName={t(isLightningEnabled
        ? 'lightning.settings.title'
        : 'lightning.settings.enableWallet')}
      extraComponent={
        <Badge className={styles.beta} type="info">
          {t('generic.beta')}
        </Badge>
      }
      onClick={() => navigate(isLightningEnabled
        ? '/settings/lightning-settings'
        : '/lightning/activate/')}
    />
  );
};
