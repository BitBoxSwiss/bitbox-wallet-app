// SPDX-License-Identifier: Apache-2.0

import { MutableRefObject, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AutoscaleInfoProvider, createChart, IChartApi, LineStyle, ISeriesApi, UTCTimestamp, MouseEventParams, ColorType } from 'lightweight-charts';
import type { TChartData, TChartTransactionMarkerAmount, FormattedLineData } from '@/api/account';
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
import styles from './chart.module.css';

type TProps = {
  className?: string;
  data?: TChartData;
  noDataPlaceholder?: JSX.Element;
  hideAmounts?: boolean;
};

const defaultData: Readonly<TChartData> = {
  chartDataMissing: true,
  chartDataDaily: [],
  chartDataHourly: [],
  chartTransactionMarkers: { daily: [], hourly: [] },
  chartFiat: 'USD',
  chartTotal: null,
  formattedChartTotal: null,
  chartIsUpToDate: false,
  lastTimestamp: 0,
};

const MARKER_HIT_RADIUS_PX = 16;
const MARKER_MIN_SHAPE_SIZE_PX = 12;
const MARKER_MAX_SHAPE_SIZE_PX = 30;
const MARKER_SNAP_RADIUS_PX = 10;
const TOOLTIP_EDGE_MARGIN_PX = 8;
const TOOLTIP_MARKER_GAP_PX = 12;

type TTooltipData = {
  markerID?: string;
  toolTipAnchorX: number;
  toolTipAnchorY: number;
  toolTipTime: number;
  toolTipValue?: string;
  toolTipVisible: boolean;
};

const hiddenTooltipData: TTooltipData = {
  toolTipAnchorX: 0,
  toolTipAnchorY: 0,
  toolTipTime: 0,
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
  className = '',
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
  const lineSeries = useRef<ISeriesApi<'Area'>>();
  const chartPointByTime = useRef<Record<number, {
    formattedValue: string;
    value: number;
  }>>({});
  const markerDataByID = useRef<Record<string, TChartMarkerData>>({});
  const markerIDByTime = useRef<Record<number, string>>({});
  const markerTimes = useRef<number[]>([]);
  const lastHapticTime = useRef<number | null>(null);
  const lastMarkerHapticID = useRef<string | null>(null);
  const snappedMarkerID = useRef<string | null>(null);

  const source = chartDisplay === 'week' ? 'hourly' : 'daily';
  const [difference, setDifference] = useState<number>();
  const [diffSince, setDiffSince] = useState<string>();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [tooltipData, setTooltipData] = useState<TTooltipData>(hiddenTooltipData);
  const [showAnimationOverlay, setAnimationOverlay] = useState(true);
  const hasChartAnimationParam = searchParams.get('with-chart-animation');

  const clearMarkerSnap = useCallback(() => {
    if (snappedMarkerID.current !== null) {
      chart.current?.clearCrosshairPosition();
      snappedMarkerID.current = null;
    }
  }, []);

  const hideTooltip = useCallback(() => {
    lastMarkerHapticID.current = null;
    setTooltipData(hiddenTooltipData);
  }, []);

  useEffect(() => {
    clearMarkerSnap();
    hideTooltip();
  }, [chartDisplay, clearMarkerSnap, defaultCurrency, hideTooltip]);

  const getMarkerPosition = useCallback((markerID: string) => {
    if (!chart.current || !lineSeries.current) {
      return null;
    }
    const markerData = markerDataByID.current[markerID];
    const markerValue = (
      markerData
        ? chartPointByTime.current[markerData.markerTime]?.value
        : undefined
    );
    if (!markerData || markerValue === undefined) {
      return null;
    }
    const x = chart.current.timeScale().timeToCoordinate(markerData.markerTime as UTCTimestamp);
    const y = lineSeries.current.priceToCoordinate(markerValue);
    return x === null || y === null ? null : { x, y };
  }, []);

  const setChartMarkers = useCallback((nextSource: 'daily' | 'hourly') => {
    const currentChart = chart.current;
    const currentSeries = lineSeries.current;
    if (!currentChart || !currentSeries) {
      return;
    }
    const rootStyle = getComputedStyle(document.documentElement);
    const chartData = nextSource === 'hourly' ? data.chartDataHourly : data.chartDataDaily;
    const transactionMarkers = data.chartTransactionMarkers?.[nextSource] || [];
    const logicalRange = currentChart.timeScale().getVisibleLogicalRange();
    const visibleBars = (
      logicalRange
        ? Math.max(logicalRange.to - logicalRange.from, 1)
        : 1
    );
    const barSpacing = currentChart.timeScale().width() / visibleBars;
    const markerBaseSize = Math.min(
      Math.max(barSpacing, MARKER_MIN_SHAPE_SIZE_PX),
      MARKER_MAX_SHAPE_SIZE_PX,
    );
    const nextMarkers = buildChartMarkers(transactionMarkers, nextSource, chartData, {
      mixed: rootStyle.getPropertyValue('--color-gray-alt').trim(),
      outline: isDarkMode ? '#1D1D1B' : '#F5F5F5',
      receive: rootStyle.getPropertyValue('--color-lightblue').trim(),
      send: rootStyle.getPropertyValue('--color-softred').trim(),
    }, MARKER_MIN_SHAPE_SIZE_PX / markerBaseSize);
    currentSeries.setMarkers(nextMarkers.markers);
    markerDataByID.current = nextMarkers.markerDataByID;
    markerIDByTime.current = nextMarkers.markerIDByTime;
    markerTimes.current = nextMarkers.markerData.map(marker => marker.markerTime);
    if (
      snappedMarkerID.current !== null
      && !nextMarkers.markerDataByID[snappedMarkerID.current]
    ) {
      clearMarkerSnap();
    }
    const priceScaleWidth = currentChart.priceScale('left').width();
    setTooltipData(current => {
      if (!current.markerID) {
        return current;
      }
      const markerData = nextMarkers.markerDataByID[current.markerID];
      const markerPosition = markerData ? getMarkerPosition(current.markerID) : null;
      if (!markerData || !markerPosition) {
        return hiddenTooltipData;
      }
      return {
        ...current,
        toolTipAnchorX: markerPosition.x + priceScaleWidth,
        toolTipAnchorY: markerPosition.y,
        toolTipTime: markerData.markerTime,
        toolTipValue: chartPointByTime.current[markerData.markerTime]?.formattedValue || '',
      };
    });
  }, [
    data.chartDataDaily,
    data.chartDataHourly,
    data.chartTransactionMarkers,
    clearMarkerSnap,
    getMarkerPosition,
    isDarkMode,
  ]);

  const findMarkerNearX = useCallback((time: number, pointX: number) => {
    const markerIDAtTime = markerIDByTime.current[time];
    if (markerIDAtTime) {
      return markerIDAtTime;
    }

    const times = markerTimes.current;
    let low = 0;
    let high = times.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const middleTime = times[middle];
      if (middleTime === undefined) {
        return undefined;
      }
      if (middleTime < time) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    let nearestMarkerID: string | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const index of [low - 1, low]) {
      const markerTime = times[index];
      if (markerTime === undefined) {
        continue;
      }
      const markerX = chart.current?.timeScale().timeToCoordinate(markerTime as UTCTimestamp);
      const markerID = markerIDByTime.current[markerTime];
      if (markerX === null || markerX === undefined || !markerID) {
        continue;
      }
      const distance = Math.abs(pointX - markerX);
      if (distance <= MARKER_SNAP_RADIUS_PX && distance < nearestDistance) {
        nearestMarkerID = markerID;
        nearestDistance = distance;
      }
    }
    return nearestMarkerID;
  }, []);

  const showChartTooltip = useCallback((
    params: Pick<MouseEventParams, 'point' | 'time'>,
    markerID?: string,
  ): boolean => {
    const currentChart = chart.current;
    const currentSeries = lineSeries.current;
    if (!currentChart || !currentSeries || !params.point) {
      return false;
    }
    const markerData = markerID ? markerDataByID.current[markerID] : undefined;
    const tooltipTime = (
      markerData?.markerTime
      ?? (typeof params.time === 'number' ? params.time : undefined)
    );
    if (tooltipTime === undefined) {
      return false;
    }
    const chartPoint = chartPointByTime.current[tooltipTime];
    const markerPosition = markerID ? getMarkerPosition(markerID) : null;
    if (markerID && (!markerData || !markerPosition || !chartPoint)) {
      return false;
    }
    if (markerData && markerPosition && chartPoint) {
      currentChart.setCrosshairPosition(
        chartPoint.value,
        markerData.markerTime as UTCTimestamp,
        currentSeries,
      );
      snappedMarkerID.current = markerData.id;
    } else {
      snappedMarkerID.current = null;
    }
    const anchorX = markerPosition?.x ?? params.point.x;
    const anchorY = (
      markerPosition?.y ?? (
        chartPoint?.value === undefined
          ? params.point.y
          : currentSeries.priceToCoordinate(chartPoint.value)
      )
    );
    if (anchorY === null) {
      return false;
    }

    setTooltipData({
      markerID,
      toolTipAnchorX: anchorX + currentChart.priceScale('left').width(),
      toolTipAnchorY: anchorY,
      toolTipVisible: true,
      toolTipValue: chartPoint?.formattedValue || '',
      toolTipTime: tooltipTime,
    });
    return true;
  }, [getMarkerPosition]);

  useLayoutEffect(() => {
    const tooltip = refToolTip.current;
    const parent = tooltip?.parentNode as HTMLDivElement | null;
    if (!tooltipData.toolTipVisible || !tooltip || !parent) {
      return;
    }
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    if (tooltipWidth === 0 || tooltipHeight === 0) {
      return;
    }
    const maxLeft = Math.max(
      TOOLTIP_EDGE_MARGIN_PX,
      parent.clientWidth - tooltipWidth - TOOLTIP_EDGE_MARGIN_PX,
    );
    const maxTop = Math.max(
      TOOLTIP_EDGE_MARGIN_PX,
      parent.clientHeight - tooltipHeight - TOOLTIP_EDGE_MARGIN_PX,
    );
    let left = Math.max(
      TOOLTIP_EDGE_MARGIN_PX,
      Math.min(maxLeft, tooltipData.toolTipAnchorX - tooltipWidth / 2),
    );
    const above = tooltipData.toolTipAnchorY - tooltipHeight - TOOLTIP_MARKER_GAP_PX;
    const below = tooltipData.toolTipAnchorY + TOOLTIP_MARKER_GAP_PX;
    let top = (
      above >= TOOLTIP_EDGE_MARGIN_PX
        ? above
        : Math.min(maxTop, below)
    );

    if (isMobile && tooltipData.markerID) {
      const right = tooltipData.toolTipAnchorX + TOOLTIP_MARKER_GAP_PX;
      const leftOfMarker = tooltipData.toolTipAnchorX - TOOLTIP_MARKER_GAP_PX - tooltipWidth;
      const fitsRight = right >= TOOLTIP_EDGE_MARGIN_PX && right <= maxLeft;
      const fitsLeft = leftOfMarker >= TOOLTIP_EDGE_MARGIN_PX && leftOfMarker <= maxLeft;

      if (fitsRight || fitsLeft) {
        const placeRight = (
          fitsRight && (
            !fitsLeft || tooltipData.toolTipAnchorX <= parent.clientWidth / 2
          )
        );
        left = placeRight ? right : leftOfMarker;
        top = Math.max(
          TOOLTIP_EDGE_MARGIN_PX,
          Math.min(maxTop, tooltipData.toolTipAnchorY - tooltipHeight / 2),
        );
      } else if (above >= TOOLTIP_EDGE_MARGIN_PX) {
        top = above;
      } else if (below <= maxTop) {
        top = below;
      } else {
        top = (
          tooltipData.toolTipAnchorY < parent.clientHeight / 2
            ? maxTop
            : TOOLTIP_EDGE_MARGIN_PX
        );
      }
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }, [
    data.chartTransactionMarkers,
    isMobile,
    tooltipData.markerID,
    tooltipData.toolTipAnchorX,
    tooltipData.toolTipAnchorY,
    tooltipData.toolTipTime,
    tooltipData.toolTipValue,
    tooltipData.toolTipVisible,
  ]);

  const handleChartClick = useCallback((params: MouseEventParams) => {
    if (!isMobile) {
      return;
    }
    if (params.point) {
      let closestMarkerID: string | undefined;
      let closestDistance = MARKER_HIT_RADIUS_PX;
      for (const markerID of Object.keys(markerDataByID.current)) {
        const markerPosition = getMarkerPosition(markerID);
        if (!markerPosition) {
          continue;
        }
        const distance = Math.hypot(
          params.point.x - markerPosition.x,
          params.point.y - markerPosition.y,
        );
        if (distance <= closestDistance) {
          closestMarkerID = markerID;
          closestDistance = distance;
        }
      }
      if (closestMarkerID && showChartTooltip(params, closestMarkerID)) {
        return;
      }
    }
    clearMarkerSnap();
    hideTooltip();
  }, [clearMarkerSnap, getMarkerPosition, hideTooltip, isMobile, showChartTooltip]);

  const displayWeek = () => {
    triggerHapticFeedback();
    setChartDisplay('week');
  };

  const displayMonth = () => {
    triggerHapticFeedback();
    setChartDisplay('month');
  };

  const displayYear = () => {
    triggerHapticFeedback();
    setChartDisplay('year');
  };

  const displayAll = () => {
    triggerHapticFeedback();
    setChartDisplay('all');
  };

  const onResize = useCallback(() => {
    const isMobile = window.innerWidth <= 768;
    setIsMobile(isMobile);
    clearMarkerSnap();
    hideTooltip();
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
    requestAnimationFrame(() => setChartMarkers(source));
  }, [chartDisplay, clearMarkerSnap, hideAmounts, hideTooltip, setChartMarkers, source]);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize]);

  const calculateChange = useCallback(() => {
    const chartData = data[source === 'daily' ? 'chartDataDaily' : 'chartDataHourly'];
    if (!chartData || !chart.current || !lineSeries.current) {
      return;
    }
    const logicalrange = chart.current.timeScale().getVisibleLogicalRange();
    if (!logicalrange) {
      return;
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
  }, [data, i18n.language, source]);

  const handleCrosshair = useCallback((params: MouseEventParams) => {
    const { point, time } = params;
    if (!refToolTip.current) {
      return;
    }
    const tooltip = refToolTip.current;
    const parent = tooltip.parentNode as HTMLDivElement;
    if (
      !lineSeries.current || !point || typeof time !== 'number'
      || point.x < 0 || point.x > parent.clientWidth
      || point.y < 0 || point.y > parent.clientHeight
    ) {
      snappedMarkerID.current = null;
      hideTooltip();
      lastHapticTime.current = null;
      return;
    }
    const crosshairX = chart.current?.timeScale().timeToCoordinate(time as UTCTimestamp);
    const markerID = (
      crosshairX === null || crosshairX === undefined
        ? markerIDByTime.current[time]
        : findMarkerNearX(time, crosshairX)
    );
    if (!showChartTooltip(params, markerID)) {
      snappedMarkerID.current = null;
      hideTooltip();
      return;
    }

    let triggeredMarkerHaptic = false;
    if (markerID) {
      if (isMobile && lastMarkerHapticID.current !== markerID) {
        triggerStrongHapticFeedback();
        lastMarkerHapticID.current = markerID;
        triggeredMarkerHaptic = true;
      }
    } else {
      lastMarkerHapticID.current = null;
    }

    const currentTime = time;
    if (triggeredMarkerHaptic) {
      lastHapticTime.current = currentTime;
      return;
    }
    if (lastHapticTime.current !== currentTime) {
      triggerHapticFeedback();
      lastHapticTime.current = currentTime;
    }
  }, [findMarkerNearX, hideTooltip, isMobile, showChartTooltip]);

  const activeChartData = source === 'hourly' ? data.chartDataHourly : data.chartDataDaily;

  useEffect(() => {
    if (ref.current && hasData && !data.chartDataMissing) {
      const chartWidth = !isMobile ? ref.current.offsetWidth : document.body.clientWidth;
      const chartHeight = !isMobile ? height : mobileHeight;
      const nextChart = createChart(ref.current, {
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
      const nextSeries = nextChart.addAreaSeries({
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
      chart.current = nextChart;
      lineSeries.current = nextSeries;
      if (styles.invisible) {
        ref.current?.classList.remove(styles.invisible);
      }
      return () => {
        nextChart.remove();
        if (chart.current === nextChart) {
          chart.current = undefined;
          lineSeries.current = undefined;
          markerDataByID.current = {};
          markerIDByTime.current = {};
          markerTimes.current = [];
          snappedMarkerID.current = null;
        }
      };
    }
  }, [
    data.chartDataMissing,
    data.chartFiat,
    hasData,
    hideAmounts,
    i18n.language,
    isDarkMode,
    isMobile,
  ]);

  useEffect(() => {
    if (!chart.current || !lineSeries.current) {
      return;
    }
    lineSeries.current.setData(activeChartData);
    chartPointByTime.current = {};
    for (const entry of activeChartData) {
      chartPointByTime.current[entry.time as number] = {
        formattedValue: entry.formattedValue,
        value: entry.value,
      };
    }
    chart.current.applyOptions({ timeScale: { timeVisible: source === 'hourly' } });
    updateRange(chart, chartDisplay);
    const animationFrame = requestAnimationFrame(() => {
      setChartMarkers(source);
      calculateChange();
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [
    activeChartData,
    calculateChange,
    chartDisplay,
    data.chartDataMissing,
    data.chartFiat,
    hasData,
    hideAmounts,
    i18n.language,
    isDarkMode,
    isMobile,
    setChartMarkers,
    source,
  ]);

  useEffect(() => {
    const currentChart = chart.current;
    if (!currentChart) {
      return;
    }
    currentChart.timeScale().subscribeVisibleLogicalRangeChange(calculateChange);
    return () => {
      currentChart.timeScale().unsubscribeVisibleLogicalRangeChange(calculateChange);
    };
  }, [
    calculateChange,
    data.chartDataMissing,
    data.chartFiat,
    hasData,
    hideAmounts,
    i18n.language,
    isDarkMode,
    isMobile,
  ]);

  useEffect(() => {
    const currentChart = chart.current;
    if (!currentChart) {
      return;
    }
    currentChart.subscribeCrosshairMove(handleCrosshair);
    currentChart.subscribeClick(handleChartClick);
    return () => {
      currentChart.unsubscribeCrosshairMove(handleCrosshair);
      currentChart.unsubscribeClick(handleChartClick);
    };
  }, [
    data.chartDataMissing,
    data.chartFiat,
    handleChartClick,
    handleCrosshair,
    hasData,
    hideAmounts,
    i18n.language,
    isDarkMode,
    isMobile,
  ]);

  useEffect(() => {
    if (data.chartDataMissing || !hasChartAnimationParam) {
      return;
    }
    setAnimationOverlay(false);
  }, [data.chartDataMissing, hasChartAnimationParam]);

  const {
    lastTimestamp,
    chartDataMissing,
    chartFiat,
    chartIsUpToDate,
    chartTotal,
    formattedChartTotal,
  } = data;

  const {
    toolTipVisible,
    toolTipValue,
    toolTipTime,
  } = tooltipData;
  const markerTooltipData = (
    tooltipData.markerID
      ? markerDataByID.current[tooltipData.markerID]
      : undefined
  );
  const showTooltipPriceDate = toolTipValue !== undefined && (!isMobile || !markerTooltipData);

  const hasDifference = hasData && difference && Number.isFinite(difference);
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
    type: 'receive' | 'send',
    markerAmount: TChartTransactionMarkerAmount,
  ) => {
    if (markerAmount.count === 0) {
      return null;
    }
    const sign = type === 'receive' ? '+' : '-';
    return (
      <span key={type} className={styles.markerTooltipRow}>
        <span className={styles.markerTooltipIcon}>
          <Arrow type={type} />
        </span>
        <span className={styles.markerTooltipAmount}>
          {markerAmount.estimated ? '\u2248 ' : ''}
          {markerAmount.amount !== '' ? sign : ''}
          <Amount amount={markerAmount.amount} unit={chartFiat} />
          <AmountUnit unit={chartFiat} className={styles.markerTooltipAmountUnit} />
        </span>
      </span>
    );
  };

  return (
    <section className={`${styles.chart || ''} ${className}`}>
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
              title={hasData ? diffSince : ''}
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
                  {markerTooltipData.transactionCount > 1 && (
                    <span className={styles.markerTooltipTitle}>
                      {t('chart.transactions', { count: markerTooltipData.transactionCount })}
                    </span>
                  )}
                  <span className={styles.markerTooltipRows}>
                    {renderMarkerTooltipRow('receive', markerTooltipData.receive)}
                    {renderMarkerTooltipRow('send', markerTooltipData.send)}
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
