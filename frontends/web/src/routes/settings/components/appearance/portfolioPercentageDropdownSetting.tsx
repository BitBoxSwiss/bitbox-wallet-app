// SPDX-License-Identifier: Apache-2.0

import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext, TPortfolioPercentageType } from '@/contexts/AppContext';
import { Dropdown, TOption } from '@/components/dropdown/dropdown';
import { useMediaQuery } from '@/hooks/mediaquery';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import settingsDropdownStyles from './settingsdropdown.module.css';

type TPortfolioPercentageOption = {
  labelKey: TPortfolioPercentageType;
  value: TPortfolioPercentageType;
};

const options: TPortfolioPercentageOption[] = [
  {
    value: 'value',
    labelKey: 'value',
  },
  {
    value: 'moneyWeightedReturn',
    labelKey: 'moneyWeightedReturn',
  },
];

export const PortfolioPercentageDropdownSetting = () => {
  const { t } = useTranslation();
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);
  const { portfolioPercentageType, updatePortfolioPercentageType } = useContext(AppContext);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const translatedOptions: TOption<TPortfolioPercentageType>[] = options.map(option => ({
    value: option.value,
    label: t(`newSettings.appearance.portfolioPerformance.options.${option.labelKey}`),
  }));
  const selectedOption = translatedOptions.find(option => option.value === portfolioPercentageType)
    || translatedOptions[0];

  return (
    <SettingsItem
      disabled={!isMobile}
      settingName={t('newSettings.appearance.portfolioPerformance.title')}
      secondaryText={t('newSettings.appearance.portfolioPerformance.description')}
      collapseOnSmall
      onClick={!isMobileSelectorOpen ? () => setIsMobileSelectorOpen(true) : undefined}
      extraComponent={
        <div data-testid="portfolio-percentage-dropdown">
          <Dropdown
            className={settingsDropdownStyles.select}
            renderOptions={(option) => option.label}
            isMulti={false}
            options={translatedOptions}
            title={t('newSettings.appearance.portfolioPerformance.title')}
            mobileFullScreen
            isOpen={isMobileSelectorOpen}
            onOpenChange={(isOpen) => setIsMobileSelectorOpen(isOpen)}
            onChange={(selected) => updatePortfolioPercentageType(selected.value)}
            value={selectedOption}
          />
        </div>
      }
    />
  );
};
