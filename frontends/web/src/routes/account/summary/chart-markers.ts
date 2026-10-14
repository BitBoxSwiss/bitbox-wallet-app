// SPDX-License-Identifier: Apache-2.0

import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import type {
  ChartData,
  TChartTransactionMarker,
  TChartTransactionMarkerAmount,
} from '@/api/account';

export type TMarkerSource = 'daily' | 'hourly';

export type TChartMarkerData = {
  id: string;
  markerTime: number;
  receive: TChartTransactionMarkerAmount;
  send: TChartTransactionMarkerAmount;
  transactionCount: number;
};

type TBuildChartMarkersResult = {
  markerData: TChartMarkerData[];
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
  if (markerData.receive.count > 0 && markerData.send.count > 0) {
    return colors.mixed;
  }
  return markerData.receive.count > 0 ? colors.receive : colors.send;
};

export const buildChartMarkers = (
  transactionMarkers: TChartTransactionMarker[],
  source: TMarkerSource,
  chartData: ChartData,
  colors: TMarkerColors,
  sizeScale = 1,
): TBuildChartMarkersResult => {
  const markerTimeByBucket: Record<number, number> = {};
  for (const entry of chartData) {
    if (typeof entry.time !== 'number') {
      continue;
    }
    const bucket = markerBucket(entry.time, source);
    const existingMarkerTime = markerTimeByBucket[bucket];
    if (existingMarkerTime === undefined || entry.time === bucket) {
      markerTimeByBucket[bucket] = entry.time;
    }
  }

  const selected: TChartMarkerData[] = [];
  for (const transactionMarker of transactionMarkers) {
    const bucket = markerBucket(transactionMarker.time, source);
    const markerTime = markerTimeByBucket[bucket];
    if (markerTime === undefined) {
      continue;
    }
    selected.push({
      id: markerID(bucket, source),
      markerTime,
      receive: transactionMarker.receive,
      send: transactionMarker.send,
      transactionCount: transactionMarker.receive.count + transactionMarker.send.count,
    });
  }
  selected.sort((a, b) => a.markerTime - b.markerTime);

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
        id,
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
    markerData: selected,
    markerDataByID,
    markerIDByTime,
    markers,
  };
};
