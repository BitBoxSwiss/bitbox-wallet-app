// SPDX-License-Identifier: Apache-2.0

import { MutableRefObject, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AutoscaleInfoProvider, createChart, IChartApi, LineData, LineStyle, LogicalRange, ISeriesApi, UTCTimestamp, MouseEventParams, ColorType, Time } from 'lightweight-charts';
import type { ConversionUnit, TChartData, TChartTransaction, ChartData, FormattedLineData } from '@/api/account';
import { usePrevious } from '@/hooks/previous';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Amount } from '@/components/amount/amount';
import { PercentageDiff } from './percentage-diff';
import { Filters } from './filters';
import { useDarkmode } from '@/hooks/darkmode';
import { RatesContext } from '@/contexts/RatesContext';
import { AppContext, TChartDisplay } from '@/contexts/AppContext';
import { AmountUnit } from '@/components/amount/amount-with-unit';
import { triggerHapticFeedback, triggerStrongHapticFeedback } from '@/utils/transport-mobile';
import { LinechartGray } from '@/components/icon';
import { Arrow } from '@/components/transactions/components/arrows';
import type { TChartMarkerData } from './chart-markers';
import { buildChartMarkers } from './chart-markers';
import type { TChartMarkerPoint, TChartPoint } from './chart-tooltip';
import { findMarkerAtPoint, findMarkerNearX, placeTooltip } from './chart-tooltip';
import styles from './chart.module.css';

type TProps = {
  data?: TChartData;
  noDataPlaceholder?: JSX.Element;
  hideAmounts?: boolean;
};

const defaultData: Readonly<TChartData> = {
  chartDataMissing: true,
  chartDataDaily: [],
  chartDataHourly: [],
  chartTransactions: [],
  chartFiat: 'USD',
  chartTotal: null,
  formattedChartTotal: null,
  chartIsUpToDate: false,
  lastTimestamp: 0,
};

type TChartPointByTime = {
  [key: number]: {
    formattedValue: string;
    value: number;
  };
};

const MARKER_SNAP_RADIUS_PX = 10;
const MOBILE_MARKER_HIT_RADIUS_PX = 16;
const MARKER_MIN_SHAPE_SIZE_PX = 12;
const MARKER_MAX_SHAPE_SIZE_PX = 30;
const MARKER_SIZE_SCALE_EPSILON = 0.01;
const MARKER_TOOLTIP_CLEARANCE_PX = 8;
const TOOLTIP_EDGE_MARGIN_PX = 8;
const TOOLTIP_MARKER_GAP_PX = 12;

type TTooltipData = {
  toolTipAnchor: TChartPoint;
  toolTipLeft: number;
  toolTipTime: number;
  toolTipTop: number;
  toolTipValue?: string;
  toolTipVisible: boolean;
};

const hiddenTooltipData: TTooltipData = {
  toolTipAnchor: { x: 0, y: 0 },
  toolTipLeft: 0,
  toolTipTime: 0,
  toolTipTop: 0,
  toolTipVisible: false,
};

const getUTCRange = () => {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const utcHours = now.getUTCHours();
  const to = new Date(Date.UTC(utcYear, utcMonth, utcDate, utcHours, 0, 0, 0));
  const from = new Date(Date.UTC(utcYear, utcMonth, utcDate, utcHours, 0, 0, 0));
  return {
    utcYear,
    utcMonth,
    utcDate,
    to,
    from,
  };
};

const updateRange = (
  chart: MutableRefObject<IChartApi | undefined>,
  chartDisplay: TChartDisplay,
) => {
  if (chart.current) {
    const { utcYear, utcMonth, utcDate, from, to } = getUTCRange();

    switch (chartDisplay) {
    case 'week': {
      from.setUTCDate(utcDate - 7);
      chart.current?.timeScale().setVisibleRange({
        from: from.getTime() / 1000 as UTCTimestamp,
        to: to.getTime() / 1000 as UTCTimestamp,
      });
      break;
    }
    case 'month': {
      from.setUTCMonth(utcMonth - 1);
      chart.current?.timeScale().setVisibleRange({
        from: from.getTime() / 1000 as UTCTimestamp,
        to: to.getTime() / 1000 as UTCTimestamp,
      });
      break;
    }
    case 'year': {
      from.setUTCFullYear(utcYear - 1);
      chart.current && chart.current.timeScale().setVisibleRange({
        from: from.getTime() / 1000 as UTCTimestamp,
        to: to.getTime() / 1000 as UTCTimestamp,
      });
      break;
    }
    case 'all':
      chart.current?.timeScale().fitContent();
      break;
    }
  }
};

const renderDate = (
  date: number,
  lang: string,
  src: string
) => {
  return new Date(date).toLocaleString(
    lang,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(src === 'hourly' ? {
        hour: '2-digit',
        minute: '2-digit',
      } : null)
    }
  );
};

const amountForChartTransaction = (transaction: TChartTransaction) => (
  transaction.type === 'receive' ? transaction.amountAtTime : transaction.deductedAmountAtTime
);

const txSign = (type: TChartTransaction['type']): string => (
  type === 'receive' ? '+' : '-'
);

const parseConversionAmount = (amount: string): number | undefined => {
  const parsedAmount = Number(amount.replace(/[',\s]/g, ''));
  return Number.isFinite(parsedAmount) ? parsedAmount : undefined;
};

const fiatDecimals = (unit: ConversionUnit): number => {
  switch (unit) {
  case 'BTC':
    return 8;
  case 'sat':
    return 0;
  default:
    return 2;
  }
};

const formatGroupedAmount = (amount: string): string => {
  const [integer = '', fraction] = amount.split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '\'');
  return fraction === undefined ? groupedInteger : `${groupedInteger}.${fraction}`;
};

export const summedFiatAmount = (
  transactions: TChartTransaction[],
  unit: ConversionUnit,
): string | undefined => {
  let sum = 0;
  for (const transaction of transactions) {
    const conversion = amountForChartTransaction(transaction).conversions?.[unit];
    if (!conversion) {
      return undefined;
    }
    const parsedAmount = parseConversionAmount(conversion);
    if (parsedAmount === undefined) {
      return undefined;
    }
    sum += parsedAmount;
  }
  const formattedSum = sum.toFixed(fiatDecimals(unit));
  return unit === 'sat' ? formattedSum : formatGroupedAmount(formattedSum);
};

const autoScaleProvider: AutoscaleInfoProvider = (original) => {
  const res = original();
  if (!res) {
    return null;
  }

  let { minValue, maxValue } = res.priceRange;
  const diff = maxValue - minValue;

  // if all values are equal or range is extremely small
  if (diff === 0 || diff < Math.abs(maxValue) * 0.001) {
    const center = maxValue;

    let padding: number;

    // define a natural padding strategy
    if (center === 0) {
      padding = 0.0001;
    } else if (center < 0.001) {
      padding = 0.0001; // for very small BTC-like values
    } else if (center < 1) {
      padding = 0.1;
    } else if (center < 1000) {
      padding = center * 0.1;
    } else {
      padding = center * 0.05;
    }

    minValue = center - padding;
    maxValue = center + padding;
  }

  // clamp to zero (balances never negative)
  if (minValue < 0) {
    minValue = 0;
  }

  return {
    priceRange: {
      minValue,
      maxValue,
    },
  };
};

export const Chart = ({
  data = defaultData,
  noDataPlaceholder,
  hideAmounts = false
}: TProps) => {
  const height: number = 300;
  const mobileHeight: number = 150;
  const hasData = data.chartDataDaily && data.chartDataDaily.length > 0;
  const hasHourlyData = data.chartDataHourly && data.chartDataHourly.length > 0;

  const { t, i18n } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const { chartDisplay, setChartDisplay } = useContext(AppContext);
  const { defaultCurrency, rotateDefaultCurrency } = useContext(RatesContext);
  const [searchParams] = useSearchParams();

  const ref = useRef<HTMLDivElement>(null);
  const refToolTip = useRef<HTMLSpanElement>(null);
  const chart = useRef<IChartApi>();
  const chartInitialized = useRef(false);
  const lineSeries = useRef<ISeriesApi<'Area'>>();
  const chartPointByTime = useRef<TChartPointByTime>({});
  const markerDataByID = useRef<Record<string, TChartMarkerData>>({});
  const markerIDByTime = useRef<Record<number, string>>({});
  const lastHapticTime = useRef<number | null>(null);
  const lastMarkerHapticID = useRef<string | null>(null);
  const snappedMarkerID = useRef<string | null>(null);
  const appliedMarkerSizeScale = useRef(1);

  const [source, setSource] = useState<'daily' | 'hourly'>(chartDisplay === 'week' ? 'hourly' : 'daily');
  const [difference, setDifference] = useState<number>();
  const [diffSince, setDiffSince] = useState<string>();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [tooltipData, setTooltipData] = useState<TTooltipData>(hiddenTooltipData);
  const tooltipDataRef = useRef(tooltipData);
  const [selectedMarkerID, setSelectedMarkerID] = useState<string | null>(null);
  const selectedMarkerIDRef = useRef(selectedMarkerID);

  tooltipDataRef.current = tooltipData;
  selectedMarkerIDRef.current = selectedMarkerID;

  useEffect(() => {
    lastMarkerHapticID.current = null;
    setTooltipData(hiddenTooltipData);
    setSelectedMarkerID(null);
  }, [defaultCurrency]);

  const [showAnimationOverlay, setAnimationOverlay] = useState(true);

  const prevChartDataDaily = usePrevious(data.chartDataDaily);
  const prevChartDataHourly = usePrevious(data.chartDataHourly);
  const prevChartFiat = usePrevious(data.chartFiat);
  const prevHideAmounts = usePrevious(hideAmounts);
  const hasChartAnimationParam = searchParams.get('with-chart-animation');

  const cacheChartData = (chartData: ChartData) => {
    chartPointByTime.current = {};
    if (snappedMarkerID.current !== null) {
      chart.current?.clearCrosshairPosition();
      snappedMarkerID.current = null;
    }

    for (const entry of chartData) {
      chartPointByTime.current[entry.time as number] = {
        formattedValue: entry.formattedValue,
        value: entry.value,
      };
    }
  };

  const clearMarkerSelection = useCallback(({
    preserveCrosshair = false,
  }: { preserveCrosshair?: boolean } = {}) => {
    lastMarkerHapticID.current = null;
    const hadSnappedMarker = snappedMarkerID.current !== null;
    snappedMarkerID.current = null;
    if (hadSnappedMarker && !preserveCrosshair) {
      chart.current?.clearCrosshairPosition();
    }
    setSelectedMarkerID(null);
  }, []);

  useEffect(() => {
    clearMarkerSelection();
    setTooltipData(hiddenTooltipData);
  }, [chartDisplay, clearMarkerSelection]);

  const getMarkerSizeScale = useCallback((logicalRange?: LogicalRange | null): number => {
    if (!chart.current) {
      return 1;
    }
    const range = logicalRange ?? chart.current.timeScale().getVisibleLogicalRange();
    if (!range) {
      return 1;
    }
    const visibleBars = Math.max(range.to - range.from, 1);
    const barSpacing = chart.current.timeScale().width() / visibleBars;
    const markerBaseSize = Math.min(
      Math.max(barSpacing, MARKER_MIN_SHAPE_SIZE_PX),
      MARKER_MAX_SHAPE_SIZE_PX,
    );
    return MARKER_MIN_SHAPE_SIZE_PX / markerBaseSize;
  }, []);

  const setChartMarkers = useCallback((nextSource: 'daily' | 'hourly', markerSizeScale = getMarkerSizeScale()) => {
    if (!lineSeries.current) {
      return;
    }
    const rootStyle = getComputedStyle(document.documentElement);
    const nextMarkers = buildChartMarkers(data.chartTransactions || [], nextSource, {
      mixed: rootStyle.getPropertyValue('--color-gray-alt').trim(),
      outline: isDarkMode ? '#1D1D1B' : '#F5F5F5',
      receive: rootStyle.getPropertyValue('--color-lightblue').trim(),
      send: rootStyle.getPropertyValue('--color-softred').trim(),
    }, markerSizeScale);
    appliedMarkerSizeScale.current = markerSizeScale;
    lineSeries.current.setMarkers(nextMarkers.markers);
    markerDataByID.current = nextMarkers.markerDataByID;
    markerIDByTime.current = nextMarkers.markerIDByTime;
    if (snappedMarkerID.current !== null && !nextMarkers.markerDataByID[snappedMarkerID.current]) {
      chart.current?.clearCrosshairPosition();
      snappedMarkerID.current = null;
    }
  }, [data.chartTransactions, getMarkerSizeScale, isDarkMode]);

  const getMarkerPoints = useCallback((): TChartMarkerPoint[] => {
    if (!chart.current || !lineSeries.current) {
      return [];
    }
    const paneSize = chart.current.paneSize();
    const markerPoints: TChartMarkerPoint[] = [];
    for (const markerData of Object.values(markerDataByID.current)) {
      const markerValue = chartPointByTime.current[markerData.markerTime]?.value;
      if (markerValue === undefined) {
        continue;
      }
      const markerX = chart.current.timeScale().timeToCoordinate(markerData.markerTime as UTCTimestamp);
      const markerY = lineSeries.current.priceToCoordinate(markerValue);
      if (markerX === null || markerY === null) {
        continue;
      }
      if (markerX < 0 || markerX > paneSize.width || markerY < 0 || markerY > paneSize.height) {
        continue;
      }
      markerPoints.push({ id: markerData.id, x: markerX, y: markerY });
    }
    return markerPoints;
  }, []);

  const snapCrosshairToMarker = useCallback((markerID: string): boolean => {
    if (!chart.current || !lineSeries.current) {
      return false;
    }
    const markerData = markerDataByID.current[markerID];
    if (!markerData) {
      return false;
    }
    const markerValue = chartPointByTime.current[markerData.markerTime]?.value;
    if (markerValue === undefined) {
      return false;
    }
    const markerTime = markerData.markerTime as UTCTimestamp;
    if (
      chart.current.timeScale().timeToCoordinate(markerTime) === null
      || lineSeries.current.priceToCoordinate(markerValue) === null
    ) {
      if (snappedMarkerID.current !== null) {
        chart.current.clearCrosshairPosition();
        snappedMarkerID.current = null;
      }
      return false;
    }
    chart.current.setCrosshairPosition(
      markerValue,
      markerTime,
      lineSeries.current,
    );
    snappedMarkerID.current = markerID;
    return true;
  }, []);

  const showChartTooltip = useCallback((
    params: Pick<MouseEventParams, 'point' | 'seriesData' | 'time'>,
    preferredTime?: number,
  ): boolean => {
    if (!refToolTip.current || !lineSeries.current || !params.point) {
      return false;
    }
    const tooltip = refToolTip.current;
    const parent = tooltip.parentNode as HTMLDivElement | null;
    if (!parent) {
      return false;
    }
    const price = params.seriesData.get(lineSeries.current) as LineData<Time> | undefined;
    const tooltipTime = preferredTime ?? (typeof params.time === 'number' ? params.time : undefined);
    if (tooltipTime === undefined) {
      return false;
    }
    const tooltipValue = chartPointByTime.current[tooltipTime]?.value ?? price?.value;
    const coordinate = tooltipValue !== undefined
      ? lineSeries.current.priceToCoordinate(tooltipValue)
      : params.point.y;
    const anchorX = preferredTime !== undefined
      ? chart.current?.timeScale().timeToCoordinate(preferredTime as UTCTimestamp)
      : params.point.x;
    if (coordinate === null || coordinate === undefined || anchorX === null || anchorX === undefined) {
      return false;
    }

    setTooltipData({
      toolTipAnchor: { x: anchorX, y: coordinate },
      toolTipVisible: true,
      toolTipValue: chartPointByTime.current[tooltipTime]?.formattedValue || '',
      toolTipTop: tooltipDataRef.current.toolTipTop,
      toolTipLeft: tooltipDataRef.current.toolTipLeft,
      toolTipTime: tooltipTime,
    });
    return true;
  }, []);

  const selectChartMarker = useCallback((
    markerID: string,
    params: Pick<MouseEventParams, 'point' | 'seriesData' | 'time'>,
  ): boolean => {
    if (!snapCrosshairToMarker(markerID)) {
      return false;
    }
    if (!showChartTooltip(params, markerDataByID.current[markerID]?.markerTime)) {
      return false;
    }
    setSelectedMarkerID(markerID);
    return true;
  }, [showChartTooltip, snapCrosshairToMarker]);

  const positionChartTooltip = useCallback(() => {
    const currentTooltipData = tooltipDataRef.current;
    const tooltip = refToolTip.current;
    const parent = tooltip?.parentNode as HTMLDivElement | null;
    if (!currentTooltipData.toolTipVisible || !tooltip || !parent) {
      return;
    }
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    if (tooltipWidth === 0 || tooltipHeight === 0) {
      return;
    }

    const markerPoints = getMarkerPoints();
    const selectedMarkerPoint = markerPoints.find(
      markerPoint => markerPoint.id === selectedMarkerIDRef.current,
    );
    const paneAnchor = selectedMarkerPoint || currentTooltipData.toolTipAnchor;
    const priceScaleWidth = chart.current?.priceScale('left').width() ?? 0;
    const anchor = { ...paneAnchor, x: paneAnchor.x + priceScaleWidth };
    const position = placeTooltip({
      anchor,
      container: {
        height: parent.clientHeight,
        width: parent.clientWidth,
      },
      markerClearance: MARKER_TOOLTIP_CLEARANCE_PX,
      markerPoints: markerPoints.map(markerPoint => ({
        ...markerPoint,
        x: markerPoint.x + priceScaleWidth,
      })),
      margin: TOOLTIP_EDGE_MARGIN_PX,
      tooltip: {
        height: tooltipHeight,
        width: tooltipWidth,
      },
      tooltipGap: TOOLTIP_MARKER_GAP_PX,
    });

    setTooltipData((existingTooltipData) => {
      if (
        !existingTooltipData.toolTipVisible
        || existingTooltipData.toolTipTime !== currentTooltipData.toolTipTime
      ) {
        return existingTooltipData;
      }
      if (
        Math.abs(existingTooltipData.toolTipLeft - position.left) < 0.5
        && Math.abs(existingTooltipData.toolTipTop - position.top) < 0.5
        && existingTooltipData.toolTipAnchor.x === paneAnchor.x
        && existingTooltipData.toolTipAnchor.y === paneAnchor.y
      ) {
        return existingTooltipData;
      }
      const nextTooltipData = {
        ...existingTooltipData,
        toolTipAnchor: paneAnchor,
        toolTipLeft: position.left,
        toolTipTop: position.top,
      };
      tooltipDataRef.current = nextTooltipData;
      return nextTooltipData;
    });
  }, [getMarkerPoints]);

  useLayoutEffect(() => {
    positionChartTooltip();
  }, [
    data.chartTransactions,
    positionChartTooltip,
    selectedMarkerID,
    tooltipData.toolTipAnchor.x,
    tooltipData.toolTipAnchor.y,
    tooltipData.toolTipTime,
    tooltipData.toolTipValue,
    tooltipData.toolTipVisible,
  ]);

  useEffect(() => {
    const tooltip = refToolTip.current;
    const parent = tooltip?.parentNode as HTMLDivElement | null;
    if (!tooltipData.toolTipVisible || !tooltip || !parent || !window.ResizeObserver) {
      return;
    }
    const resizeObserver = new ResizeObserver(positionChartTooltip);
    resizeObserver.observe(parent);
    resizeObserver.observe(tooltip);
    return () => resizeObserver.disconnect();
  }, [positionChartTooltip, tooltipData.toolTipVisible]);

  const handleChartClick = useCallback((params: MouseEventParams) => {
    if (!isMobile) {
      return;
    }
    const markerID = params.point
      ? findMarkerAtPoint(params.point, getMarkerPoints(), MOBILE_MARKER_HIT_RADIUS_PX)
      : null;
    if (markerID && selectChartMarker(markerID, params)) {
      return;
    }
    clearMarkerSelection();
    setTooltipData((tooltipData) => ({
      ...tooltipData,
      toolTipVisible: false,
    }));
  }, [getMarkerPoints, clearMarkerSelection, isMobile, selectChartMarker]);

  const displayWeek = () => {
    triggerHapticFeedback();
    if (source !== 'hourly' && lineSeries.current && data.chartDataHourly && chart.current) {
      lineSeries.current.setData(data.chartDataHourly || []);
      cacheChartData(data.chartDataHourly || []);
      setChartMarkers('hourly');
      chart.current.applyOptions({ timeScale: { timeVisible: true } });
    }
    setChartDisplay('week');
    setSource('hourly');
  };

  const displayMonth = () => {
    triggerHapticFeedback();
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(data.chartDataDaily || []);
      cacheChartData(data.chartDataDaily || []);
      setChartMarkers('daily');
      chart.current.applyOptions({ timeScale: { timeVisible: false } });
    }
    setChartDisplay('month');
    setSource('daily');
  };

  const displayYear = () => {
    triggerHapticFeedback();
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(data.chartDataDaily);
      cacheChartData(data.chartDataDaily);
      setChartMarkers('daily');
      chart.current.applyOptions({ timeScale: { timeVisible: false } });
    }
    setChartDisplay('year');
    setSource('daily');
  };

  const displayAll = () => {
    triggerHapticFeedback();
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(data.chartDataDaily);
      cacheChartData(data.chartDataDaily);
      setChartMarkers('daily');
      chart.current.applyOptions({ timeScale: { timeVisible: false } });
    }
    setChartDisplay('all');
    setSource('daily');
  };

  useEffect(() => {
    updateRange(chart, chartDisplay);
  }, [chart, chartDisplay]);

  const onResize = useCallback(() => {
    const isMobile = window.innerWidth <= 768;
    setIsMobile(isMobile);
    if (!chart.current || !ref.current) {
      return;
    }
    const chartWidth = !isMobile ? ref.current.offsetWidth : document.body.clientWidth;
    const chartHeight = !isMobile ? height : mobileHeight;
    chart.current.resize(chartWidth, chartHeight);
    chart.current.applyOptions({
      grid: {
        horzLines: {
          visible: !isMobile
        }
      },
      timeScale: {
        visible: !isMobile
      },
      leftPriceScale: {
        visible: hideAmounts ? false : !isMobile,
      },
    });
    updateRange(chart, chartDisplay);
  }, [chartDisplay, hideAmounts]);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize]);

  const calculateChange = useCallback(() => {
    const chartData = data[source === 'daily' ? 'chartDataDaily' : 'chartDataHourly'];
    if (!chartData || !chart.current || !lineSeries.current) {
      return;
    }
    const logicalrange = chart.current.timeScale().getVisibleLogicalRange() as LogicalRange | null;
    if (!logicalrange) {
      return;
    }
    const markerSizeScale = getMarkerSizeScale(logicalrange);
    if (Math.abs(markerSizeScale - appliedMarkerSizeScale.current) > MARKER_SIZE_SCALE_EPSILON) {
      setChartMarkers(source, markerSizeScale);
    }
    const visiblerange = lineSeries.current.barsInLogicalRange(logicalrange);
    if (!visiblerange) {
      // if the chart is empty, during first load, barsInLogicalRange is null
      return;
    }
    const rangeFrom = Math.max(Math.floor(visiblerange.barsBefore), 0);
    if (!chartData[rangeFrom]) {
      // when data series have changed it triggers subscribeVisibleLogicalRangeChange
      // but at this point the setVisibleRange has not executed what the new range
      // should be and therefore barsBefore might still point to the old range
      // so we have to ignore this call and expect setVisibleRange with correct range
      setDifference(0);
      setDiffSince('');
      return;
    }
    const nextValue = chartData[rangeFrom + 1] as FormattedLineData | undefined;
    const valueFrom = chartData[rangeFrom].value === 0 ? nextValue?.value : chartData[rangeFrom].value;
    if (!valueFrom || !Number.isFinite(valueFrom)) {
      setDifference(0);
      setDiffSince('');
      return;
    }
    const valueTo = data.chartTotal;
    const valueDiff = valueTo ? valueTo - valueFrom : 0;
    setDifference(valueDiff / valueFrom);
    setDiffSince(`${chartData[rangeFrom].formattedValue} (${renderDate(Number(chartData[rangeFrom].time) * 1000, i18n.language, source)})`);
  }, [data, getMarkerSizeScale, i18n.language, setChartMarkers, source]);

  const handleCrosshair = useCallback(({
    point,
    time,
    seriesData,
  }: MouseEventParams) => {
    if (!refToolTip.current) {
      return;
    }
    const tooltip = refToolTip.current;
    const parent = tooltip.parentNode as HTMLDivElement;
    if (
      !lineSeries.current || !point || !time
      || point.x < 0 || point.x > parent.clientWidth
      || point.y < 0 || point.y > parent.clientHeight
    ) {
      setTooltipData((tooltipData) => ({
        ...tooltipData,
        toolTipVisible: false
      }));
      clearMarkerSelection({ preserveCrosshair: true });
      lastHapticTime.current = null;
      return;
    }
    const markerPoints = getMarkerPoints();
    const crosshairX = typeof time === 'number'
      ? chart.current?.timeScale().timeToCoordinate(time as UTCTimestamp)
      : null;
    const markerIDAtTime = typeof time === 'number' ? markerIDByTime.current[time] : null;
    const markerID = markerIDAtTime || (
      crosshairX === null || crosshairX === undefined
        ? null
        : findMarkerNearX(crosshairX, markerPoints, MARKER_SNAP_RADIUS_PX)
    );
    let triggeredMarkerHaptic = false;
    if (markerID) {
      if (!selectChartMarker(markerID, { point, time, seriesData })) {
        clearMarkerSelection({ preserveCrosshair: true });
        return;
      }
      if (isMobile && lastMarkerHapticID.current !== markerID) {
        triggerStrongHapticFeedback();
        lastMarkerHapticID.current = markerID;
        triggeredMarkerHaptic = true;
      }
    } else {
      if (!showChartTooltip({ point, time, seriesData })) {
        clearMarkerSelection({ preserveCrosshair: true });
        return;
      }
      clearMarkerSelection({ preserveCrosshair: true });
    }

    const currentTime = time as number;
    if (triggeredMarkerHaptic) {
      lastHapticTime.current = currentTime;
      return;
    }
    if (lastHapticTime.current !== currentTime) {
      triggerHapticFeedback();
      lastHapticTime.current = currentTime;
    }
  }, [getMarkerPoints, clearMarkerSelection, isMobile, selectChartMarker, showChartTooltip]);

  const removeChart = useCallback(() => {
    if (chartInitialized.current) {
      chart.current?.timeScale().unsubscribeVisibleLogicalRangeChange(calculateChange);
      chart.current?.unsubscribeCrosshairMove(handleCrosshair);
      chart.current?.unsubscribeClick(handleChartClick);
      chart.current?.remove();
      chart.current = undefined;
      chartInitialized.current = false;
      markerDataByID.current = {};
      markerIDByTime.current = {};
    }
  }, [calculateChange, handleChartClick, handleCrosshair]);

  const initChart = useCallback(() => {
    if (ref.current && hasData && !data.chartDataMissing) {
      const chartWidth = !isMobile ? ref.current.offsetWidth : document.body.clientWidth;
      const chartHeight = !isMobile ? height : mobileHeight;
      chart.current = createChart(ref.current, {
        width: chartWidth,
        height: chartHeight,
        handleScroll: false,
        handleScale: false,
        crosshair: {
          vertLine: {
            visible: false,
            labelVisible: false,
          },
          horzLine: {
            visible: false,
            labelVisible: false,
          },
          mode: 1,
        },
        grid: {
          vertLines: {
            visible: false,
          },
          horzLines: {
            color: isDarkMode ? '#333333' : '#dedede',
            style: LineStyle.Solid,
            visible: !isMobile,
          },
        },
        layout: {
          background: {
            type: ColorType.Solid,
            color: isDarkMode ? '#1D1D1B' : '#F5F5F5',
          },
          fontSize: 11,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Roboto", "Oxygen", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          textColor: isDarkMode ? '#F5F5F5' : '#1D1D1B',
        },
        leftPriceScale: {
          borderVisible: false,
          ticksVisible: false,
          visible: hideAmounts ? false : !isMobile,
          entireTextOnly: true,
        },
        localization: {
          locale: i18n.language,
        },
        rightPriceScale: {
          visible: false,
          ticksVisible: false,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: false,
          visible: !isMobile,
        },
        trackingMode: {
          exitMode: 0
        }
      });
      lineSeries.current = chart.current.addAreaSeries({
        priceLineVisible: false,
        lastValueVisible: false,
        autoscaleInfoProvider: autoScaleProvider,
        priceFormat: (
          data.chartFiat === 'BTC' ? {
            minMove: 0.000001,
            type: 'custom',
            formatter: (price: number) => {
              if (price <= 0) {
                return '0';
              }
              return price.toLocaleString(i18n.language, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8,
              });
            }
          } : {
            type: 'volume',
          }),
        topColor: isDarkMode ? '#5E94BF' : '#DFF1FF',
        bottomColor: isDarkMode ? '#1D1D1B' : '#F5F5F5',
        lineColor: 'rgba(94, 148, 192, 1)',
        crosshairMarkerRadius: 6,
      });
      const isChartDisplayWeekly = chartDisplay === 'week';
      const dataToDisplay = (
        isChartDisplayWeekly
          ? data.chartDataHourly
          : data.chartDataDaily
      );
      lineSeries.current.setData(dataToDisplay);
      cacheChartData(dataToDisplay);
      setChartMarkers(isChartDisplayWeekly ? 'hourly' : 'daily');
      chart.current.timeScale().subscribeVisibleLogicalRangeChange(calculateChange);
      chart.current.subscribeCrosshairMove(handleCrosshair);
      chart.current.subscribeClick(handleChartClick);
      chart.current.timeScale().fitContent();
      if (styles.invisible) {
        ref.current?.classList.remove(styles.invisible);
      }
      chartInitialized.current = true;
      updateRange(chart, chartDisplay);
    }
  }, [calculateChange, chartDisplay, data.chartDataDaily, data.chartDataHourly, data.chartDataMissing, data.chartFiat, handleChartClick, handleCrosshair, hasData, hideAmounts, i18n.language, isDarkMode, isMobile, setChartMarkers]);

  const reinitializeChart = () => {
    removeChart();
    initChart();
  };

  if (source === 'daily' && prevChartDataDaily?.length !== data.chartDataDaily.length) {
    lineSeries.current?.setData(data.chartDataDaily);
    setChartMarkers('daily');
    chart.current?.timeScale().fitContent();
    cacheChartData(data.chartDataDaily);
  }

  if (source === 'hourly' && prevChartDataHourly?.length !== data.chartDataHourly.length) {
    lineSeries.current?.setData(data.chartDataHourly);
    setChartMarkers('hourly');
    chart.current?.timeScale().fitContent();
    cacheChartData(data.chartDataHourly);
  }

  if (prevChartFiat !== data.chartFiat) {
    reinitializeChart();
  }

  if (prevHideAmounts !== hideAmounts) {
    chart.current?.applyOptions({
      leftPriceScale: {
        visible: hideAmounts ? false : !isMobile,
      }
    });
  }

  useEffect(() => {
    if (!chartInitialized.current) {
      initChart();
    }
    return () => {
      removeChart();
    };
  }, [initChart, removeChart]);

  useEffect(() => {
    if (data.chartDataMissing || !hasChartAnimationParam) {
      return;
    }
    setAnimationOverlay(false);
  }, [data.chartDataMissing, hasChartAnimationParam]);

  useEffect(() => {
    setChartMarkers(source);
  }, [data.chartTransactions, setChartMarkers, source]);

  useEffect(() => {
    if (selectedMarkerID && !markerDataByID.current[selectedMarkerID]) {
      clearMarkerSelection();
    }
  }, [data.chartTransactions, clearMarkerSelection, selectedMarkerID, source]);

  useEffect(() => {
    const { utcYear, utcMonth, utcDate, from, to } = getUTCRange();

    switch (chartDisplay) {
    case 'week': {
      from.setUTCDate(utcDate - 7);
      chart.current?.timeScale().setVisibleRange({
        from: from.getTime() / 1000 as UTCTimestamp,
        to: to.getTime() / 1000 as UTCTimestamp,
      });
      break;
    }
    case 'month': {
      from.setUTCMonth(utcMonth - 1);
      chart.current?.timeScale().setVisibleRange({
        from: from.getTime() / 1000 as UTCTimestamp,
        to: to.getTime() / 1000 as UTCTimestamp,
      });
      break;
    }
    case 'year': {
      from.setUTCFullYear(utcYear - 1);
      chart.current && chart.current.timeScale().setVisibleRange({
        from: from.getTime() / 1000 as UTCTimestamp,
        to: to.getTime() / 1000 as UTCTimestamp,
      });
      break;
    }
    case 'all': {
      chart.current?.timeScale().fitContent();
      break;
    }
    }
  }, [source, chartDisplay]);

  const {
    lastTimestamp,
    chartDataMissing,
    chartFiat,
    chartIsUpToDate,
    chartTotal,
    formattedChartTotal,
  } = data;

  if (!hasData && chartIsUpToDate && difference) {
    setDiffSince('');
    setDifference(0);
  }

  const {
    toolTipVisible,
    toolTipValue,
    toolTipTop,
    toolTipLeft,
    toolTipTime,
  } = tooltipData;
  const markerTooltipData = selectedMarkerID
    ? markerDataByID.current[selectedMarkerID]
    : undefined;
  const showTooltipPriceDate = toolTipValue !== undefined && (!isMobile || !markerTooltipData);

  const hasDifference = difference && Number.isFinite(difference);
  const disableFilters = !hasData || chartDataMissing;
  const disableWeeklyFilters = !hasHourlyData || chartDataMissing;
  const showMobileTotalValue = toolTipVisible && !!toolTipValue && isMobile && !markerTooltipData;
  const chartFiltersProps = {
    display: chartDisplay,
    disableFilters,
    disableWeeklyFilters,
    onDisplayWeek: displayWeek,
    onDisplayMonth: displayMonth,
    onDisplayYear: displayYear,
    onDisplayAll: displayAll,
  };

  const chartHeight = `${!isMobile ? height : mobileHeight}px`;

  const renderMarkerTooltipRow = (
    type: TChartTransaction['type'],
    transactions: TChartTransaction[],
  ) => {
    if (transactions.length === 0) {
      return null;
    }
    const fiatAmount = summedFiatAmount(transactions, chartFiat);
    return (
      <span key={type} className={styles.markerTooltipRow}>
        <span className={styles.markerTooltipIcon}>
          <Arrow type={type} />
        </span>
        <span className={styles.markerTooltipAmount}>
          {fiatAmount !== undefined ? txSign(type) : ''}
          <Amount amount={fiatAmount || ''} unit={chartFiat} />
          <AmountUnit unit={chartFiat} className={styles.markerTooltipAmountUnit} />
        </span>
      </span>
    );
  };

  return (
    <section className={styles.chart}>
      <header>
        <div className={styles.summary}>
          <div className={styles.totalValue}>
            {formattedChartTotal !== null ? (
              // remove trailing zeroes for BTC fiat total
              <Amount
                amount={!showMobileTotalValue ? formattedChartTotal : toolTipValue}
                unit={chartFiat}
                onMobileClick={rotateDefaultCurrency}
              />
            ) : (
              <Skeleton minWidth="220px" />
            )}
            <span className={styles.totalUnit}>
              {chartTotal !== null && <AmountUnit unit={chartFiat} rotateUnit={rotateDefaultCurrency}/>}
            </span>
          </div>
          {!showMobileTotalValue ? (
            <PercentageDiff
              hasDifference={!!hasDifference}
              difference={difference}
              title={diffSince}
            />
          ) : (
            <span className={styles.diffValue}>
              {renderDate(toolTipTime * 1000, i18n.language, source)}
            </span>
          )}
        </div>
        {!isMobile && <Filters {...chartFiltersProps} />}
      </header>
      {!chartDataMissing && hasChartAnimationParam && (
        <div
          style={{ minHeight: chartHeight }}
          className={`
          ${styles.transitionDiv || ''}
          ${showAnimationOverlay ? '' : styles.overlayRemove || ''}`}
        />
      )}
      <div className={styles.chartCanvas} style={{ minHeight: chartHeight }}>
        {chartDataMissing ? (
          <div className={styles.chartUnavailableMessageContainer} style={{ height: chartHeight }}>
            <div className={styles.chartUnavailableMessage}>
              <LinechartGray />
              <p>
                {t('chart.dataMissing')}
              </p>
            </div>
          </div>
        ) : hasData ? !chartIsUpToDate && (
          <div className={styles.chartUpdatingMessage}>
            {t('chart.dataOldTimestamp', {
              time: new Date(lastTimestamp).toLocaleString(i18n.language)
            })}
          </div>
        ) : (
          <div className={styles.placeholderContainer}>
            {noDataPlaceholder}
          </div>
        )}
        <div ref={ref} className={styles.invisible}></div>
        <span
          ref={refToolTip}
          className={styles.tooltip}
          style={{ left: toolTipLeft, top: toolTipTop }}
          hidden={!toolTipVisible || (isMobile && !markerTooltipData)}>
          {showTooltipPriceDate || markerTooltipData ? (
            <span>
              {showTooltipPriceDate && (
                <>
                  <h2 className={styles.toolTipValue}>
                    <Amount amount={toolTipValue} unit={chartFiat} />
                    <span className={styles.toolTipUnit}>{chartFiat}</span>
                  </h2>
                  <span className={styles.toolTipTime}>
                    {renderDate(toolTipTime * 1000, i18n.language, source)}
                  </span>
                </>
              )}
              {markerTooltipData && (
                <span
                  className={showTooltipPriceDate
                    ? styles.markerTooltipInner
                    : [styles.markerTooltipInner, styles.markerTooltipOnly].join(' ')}>
                  {markerTooltipData.transactions.length > 1 && (
                    <span className={styles.markerTooltipTitle}>
                      {t('chart.transactions', { count: markerTooltipData.transactions.length })}
                    </span>
                  )}
                  <span className={styles.markerTooltipRows}>
                    {renderMarkerTooltipRow('receive', markerTooltipData.receiveTransactions)}
                    {renderMarkerTooltipRow('send', markerTooltipData.sendTransactions)}
                  </span>
                </span>
              )}
            </span>
          ) : null}
        </span>
      </div>
      {isMobile && <Filters {...chartFiltersProps} />}
    </section>
  );
};
