// SPDX-License-Identifier: Apache-2.0

import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import type { TChartTransaction } from '@/api/account';

export type TMarkerSource = 'daily' | 'hourly';

export type TChartMarkerData = {
  id: string;
  markerTime: number;
  transactions: TChartTransaction[];
  receiveTransactions: TChartTransaction[];
  sendTransactions: TChartTransaction[];
};

type TBuildChartMarkersResult = {
  markerDataByID: Record<string, TChartMarkerData>;
  markerIDByTime: Record<number, string>;
  markers: SeriesMarker<UTCTimestamp>[];
};

type TMarkerColors = {
  mixed: string;
  outline: string;
  receive: string;
  send: string;
};

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const OUTLINE_MARKER_SIZE = 1.6;
const INNER_MARKER_SIZE = 0.95;

const markerID = (markerTime: number, source: TMarkerSource): string => (
  `${source}:${markerTime}`
);

const markerBucket = (timestamp: number, source: TMarkerSource): number => {
  const bucketSize = source === 'hourly' ? HOUR_SECONDS : DAY_SECONDS;
  return Math.floor(timestamp / bucketSize) * bucketSize;
};

const markerColor = (markerData: TChartMarkerData, colors: TMarkerColors): string => {
  if (markerData.receiveTransactions.length > 0 && markerData.sendTransactions.length > 0) {
    return colors.mixed;
  }
  return markerData.receiveTransactions.length > 0 ? colors.receive : colors.send;
};

const createMarkerData = (
  markerTime: number,
  source: TMarkerSource,
): TChartMarkerData => (
  {
    id: markerID(markerTime, source),
    markerTime,
    transactions: [],
    receiveTransactions: [],
    sendTransactions: [],
  }
);

export const buildChartMarkers = (
  transactions: TChartTransaction[],
  source: TMarkerSource,
  colors: TMarkerColors,
  sizeScale = 1,
): TBuildChartMarkersResult => {
  const markerDataByBucket: Record<number, TChartMarkerData> = {};

  for (const transaction of transactions) {
    if (transaction.type !== 'send' && transaction.type !== 'receive') {
      continue;
    }
    if (!transaction.time) {
      continue;
    }
    const bucket = markerBucket(transaction.time, source);
    const markerData = markerDataByBucket[bucket] || createMarkerData(bucket, source);
    markerData.transactions.push(transaction);
    if (transaction.type === 'receive') {
      markerData.receiveTransactions.push(transaction);
    } else {
      markerData.sendTransactions.push(transaction);
    }
    markerDataByBucket[bucket] = markerData;
  }

  const selected = Object.values(markerDataByBucket).sort((a, b) => a.markerTime - b.markerTime);

  const markerDataByID: Record<string, TChartMarkerData> = {};
  const markerIDByTime: Record<number, string> = {};
  const markers: SeriesMarker<UTCTimestamp>[] = [];

  for (const markerData of selected) {
    const { id, markerTime } = markerData;
    const time = markerTime as UTCTimestamp;
    markerDataByID[id] = markerData;
    markerIDByTime[markerTime] = id;
    markers.push(
      {
        time,
        position: 'inBar' as const,
        shape: 'circle' as const,
        color: colors.outline,
        size: OUTLINE_MARKER_SIZE * sizeScale,
      },
      {
        id,
        time,
        position: 'inBar' as const,
        shape: 'circle' as const,
        color: markerColor(markerData, colors),
        size: INNER_MARKER_SIZE * sizeScale,
      }
    );
  }

  return {
    markerDataByID,
    markerIDByTime,
    markers,
  };
};
