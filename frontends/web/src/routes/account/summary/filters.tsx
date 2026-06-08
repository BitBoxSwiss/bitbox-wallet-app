// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { TChartFiltersProps } from './types';
import { PillButton, PillButtonGroup } from '@/components/pillbuttongroup/pillbuttongroup';
import styles from './chart.module.css';
import { Toggle } from '@/components/toggle/toggle';

export const Filters = ({
  display,
  disableFilters,
  disableWeeklyFilters,
  onDisplayWeek,
  onDisplayMonth,
  onDisplayYear,
  onDisplayAll,
  showPercent,
  onTogglePercent
}: TChartFiltersProps) => {
  const { t } = useTranslation();
  return (
    <PillButtonGroup className={styles.filters}>
      <PillButton
        active={display === 'week'}
        disabled={disableFilters || disableWeeklyFilters}
        onClick={onDisplayWeek}
      >
        {t('chart.filter.week')}
      </PillButton>
      <PillButton
        active={display === 'month'}
        disabled={disableFilters}
        onClick={onDisplayMonth}
      >
        {t('chart.filter.month')}
      </PillButton>
      <PillButton
        active={display === 'year'}
        disabled={disableFilters}
        onClick={onDisplayYear}
      >
        {t('chart.filter.year')}
      </PillButton>
      <PillButton
        active={display === 'all'}
        disabled={disableFilters}
        onClick={onDisplayAll}
      >
        {t('chart.filter.all')}
      </PillButton>
      <span className={styles.toggleWrapper}>
        <span className={`${styles.toggleSymbol} ${!showPercent ? styles.toggleSymbolActive : ''}`}>∑</span>
        <Toggle checked={showPercent} onChange={onTogglePercent} />
        <span className={`${styles.toggleSymbol} ${showPercent ? styles.toggleSymbolActive : ''}`}>%</span>
      </span>
    </PillButtonGroup>
  );
};
