// SPDX-License-Identifier: Apache-2.0

import type { Range, UTCTimestamp } from 'lightweight-charts';
import type { TChartDisplay } from '@/contexts/AppContext';

export const getChartVisibleRange = (
  chartDisplay: TChartDisplay,
  startTimestamp: number | null,
  now: Date = new Date(),
): Range<UTCTimestamp> | undefined => {
  if (chartDisplay === 'all' || startTimestamp === null) {
    return undefined;
  }

  const to = new Date(now);
  to.setUTCMinutes(0, 0, 0);
  return {
    from: startTimestamp as UTCTimestamp,
    to: to.getTime() / 1000 as UTCTimestamp,
  };
};
