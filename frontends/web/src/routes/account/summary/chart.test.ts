// SPDX-License-Identifier: Apache-2.0

import type { UTCTimestamp } from 'lightweight-charts';
import { describe, expect, it } from 'vitest';
import type { ChartData, TChartTransaction } from '@/api/account';
import { buildChartMarkers } from './chart-markers';
import { summedFiatAmount } from './chart';

const HOUR_SECONDS = 60 * 60;

const makeTransaction = (
  time: number,
  internalID: string,
  conversion = '1.00',
  estimated = false,
): TChartTransaction => ({
  time,
  internalID,
  accountCode: 'acc-1',
  explorerURL: 'https://example.com/tx/',
  type: 'receive',
  amountAtTime: {
    amount: '0.10000000',
    unit: 'BTC',
    estimated,
    conversions: {
      USD: conversion,
    },
  },
  deductedAmountAtTime: {
    amount: '0.10000000',
    unit: 'BTC',
    estimated,
    conversions: {
      USD: conversion,
    },
  },
});

const chartPoint = (time: number): ChartData[number] => ({
  time: time as UTCTimestamp,
  value: 1,
  formattedValue: '1.00',
});

describe('chart transaction markers', () => {
  it('aligns markers to the active series and filters absent buckets', () => {
    const activeHour = 1_700_010_000;
    const livePointTime = activeHour + 30 * 60;
    const oldHour = activeHour - 8 * 24 * HOUR_SECONDS;
    const result = buildChartMarkers(
      [
        makeTransaction(oldHour + 10 * 60, 'old'),
        makeTransaction(activeHour + 10 * 60, 'active'),
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
    expect(result.markers.every(marker => marker.time === livePointTime)).toBe(true);
    expect(result.markerIDByTime[livePointTime]).toBe(`hourly:${activeHour}`);
    expect(result.markerDataByID[`hourly:${activeHour}`]?.transactions).toEqual([
      expect.objectContaining({ internalID: 'active' }),
    ]);
  });

  it('marks an aggregate as estimated when any contributing amount is estimated', () => {
    expect(summedFiatAmount([
      makeTransaction(1_700_000_000, 'exact', '1,000.23'),
      makeTransaction(1_700_000_001, 'estimated', '234.33', true),
    ], 'USD')).toEqual({
      amount: '1\'234.56',
      estimated: true,
    });
  });
});
