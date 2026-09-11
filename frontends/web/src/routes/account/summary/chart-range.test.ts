// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { getChartVisibleRange } from './chart-range';

describe('getChartVisibleRange', () => {
  it('uses the canonical backend start and rounds the end to the current UTC hour', () => {
    const now = new Date('2026-01-31T15:30:45.000Z');
    const startTimestamp = Date.parse('2025-12-31T15:00:00.000Z') / 1000;

    expect(getChartVisibleRange('month', startTimestamp, now)).toEqual({
      from: startTimestamp,
      to: Date.parse('2026-01-31T15:00:00.000Z') / 1000,
    });
  });

  it('fits all available content for the all-time display', () => {
    expect(getChartVisibleRange('all', null)).toBeUndefined();
  });
});
