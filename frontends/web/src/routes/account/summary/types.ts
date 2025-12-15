// SPDX-License-Identifier: Apache-2.0

import type { TChartDisplay } from '@/contexts/AppContext';

export type TChartFiltersProps = {
  display: TChartDisplay;
  disableFilters: boolean;
  disableWeeklyFilters: boolean;
  onDisplayWeek: () => void;
  onDisplayMonth: () => void;
  onDisplayYear: () => void;
  onDisplayAll: () => void;
};

