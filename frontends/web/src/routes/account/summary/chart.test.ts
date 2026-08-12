// SPDX-License-Identifier: Apache-2.0

import type { UTCTimestamp } from 'lightweight-charts';
import { describe, expect, it } from 'vitest';
import type { ChartData, TChartTransactionMarker } from '@/api/account';
import { buildChartMarkers } from './chart-markers';

const chartPoint = (time: number): ChartData[number] => ({
  time: time as UTCTimestamp,
  value: 1,
  formattedValue: '1.00',
});

const marker = (
  time: number,
  receiveCount: number,
  sendCount: number,
): TChartTransactionMarker => ({
  time,
  receive: {
    amount: '0.01',
    count: receiveCount,
    estimated: true,
  },
  send: {
    amount: '0.02',
    count: sendCount,
    estimated: false,
  },
});

describe('chart transaction markers', () => {
  it('aligns aggregate buckets to the active series and filters absent buckets', () => {
    const activeHour = 1_700_010_000;
    const livePointTime = activeHour + 30 * 60;
    const result = buildChartMarkers(
      [
        marker(activeHour - 8 * 24 * 60 * 60, 1, 0),
        marker(activeHour, 2, 1),
      ],
      'hourly',
      [chartPoint(livePointTime)],
      {
        mixed: 'gray',
        outline: 'white',
        receive: 'blue',
        send: 'red',
      },
    );

    expect(result.markers).toHaveLength(2);
    expect(result.markers.every(point => point.time === livePointTime)).toBe(true);
    expect(result.markers.every(point => point.id === `hourly:${activeHour}`)).toBe(true);
    expect(result.markerIDByTime[livePointTime]).toBe(`hourly:${activeHour}`);
    expect(result.markerDataByID[`hourly:${activeHour}`]).toMatchObject({
      receive: { amount: '0.01', count: 2, estimated: true },
      send: { amount: '0.02', count: 1, estimated: false },
      transactionCount: 3,
    });
  });
});
