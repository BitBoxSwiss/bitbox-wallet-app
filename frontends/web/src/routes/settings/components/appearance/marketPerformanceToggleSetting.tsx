// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '@/components/toggle/toggle';
import { useConfig } from '@/contexts/ConfigProvider';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export const MarketPerformanceToggleSetting = () => {
  const { t } = useTranslation();
  const { config, setConfig } = useConfig();

  const handleToggleMarketPerformance = async (e: ChangeEvent<HTMLInputElement>) => {
    await setConfig({
      frontend: {
        marketPerformanceChart: e.target.checked
      },
    });
  };

  return (
    <SettingsItem
      settingName={t('newSettings.appearance.marketPerformanceChart.title')}
      secondaryText={t('newSettings.appearance.marketPerformanceChart.description')}
      extraComponent={
        config ? (
          <Toggle
            checked={config.frontend.marketPerformanceChart || false}
            onChange={handleToggleMarketPerformance}
          />
        ) : null
      }
    />
  );
};
