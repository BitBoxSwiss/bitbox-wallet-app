/**
 * Copyright 2022-2024 Shift Crypto AG
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
import { TChartFiltersProps } from './types';
import {
  PillButton,
  PillButtonGroup,
} from '@/components/pillbuttongroup/pillbuttongroup';
import styles from './chart.module.css';

export const Filters = ({
  display,
  disableFilters,
  disableWeeklyFilters,
  onDisplayWeek,
  onDisplayMonth,
  onDisplayYear,
  onDisplayAll,
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
    </PillButtonGroup>
  );
};
