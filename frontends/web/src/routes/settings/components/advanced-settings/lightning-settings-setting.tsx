// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/badge/badge';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import styles from './lightning-settings-setting.module.css';

export const LightningSettingsSetting = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <SettingsItem
      settingName={t('lightning.settings.title')}
      extraComponent={
        <Badge className={styles.beta} type="info">
          {t('generic.beta')}
        </Badge>
      }
      onClick={() => navigate('/settings/lightning-settings')}
    />
  );
};
