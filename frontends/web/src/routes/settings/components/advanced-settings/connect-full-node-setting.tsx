// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export const ConnectFullNodeSetting = () => {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <SettingsItem
      settingName={t('settings.expert.electrum.title')}
      onClick={() => navigate('/settings/electrum')}
      secondaryText={t('settings.expert.electrum.description')}
    />
  );
};
