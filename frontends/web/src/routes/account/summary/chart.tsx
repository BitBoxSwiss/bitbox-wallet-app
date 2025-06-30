/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { MutableRefObject, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { createChart, IChartApi, LineData, LineStyle, LogicalRange, ISeriesApi, UTCTimestamp, MouseEventParams, ColorType, Time } from 'lightweight-charts';
import type { TSummary, ChartData } from '@/api/account';
import { usePrevious } from '@/hooks/previous';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Amount } from '@/components/amount/amount';
import { PercentageDiff } from './percentage-diff';
import { Filters } from './filters';
import { getDarkmode } from '@/components/darkmode/darkmode';
import { RatesContext } from '@/contexts/RatesContext';
import { AppContext, TChartDisplay } from '@/contexts/AppContext';
import { AmountUnit } from '@/components/amount/amount-with-unit';
import styles from './chart.module.css';

type TProps = {
  data?: TSummary; // <- Hier kommen die Chart-Daten rein
  noDataPlaceholder?: JSX.Element;
  hideAmounts?: boolean;
};

const defaultData: Readonly<TSummary> = {
  chartDataMissing: true,
  chartDataDaily: [],
  chartDataHourly: [],
  chartFiat: 'USD',
  chartTotal: null,
  formattedChartTotal: null,
  chartIsUpToDate: false,
  lastTimestamp: 0,
};

type FormattedData = {
  [key: number]: string;
}

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
  const { chartDisplay, setChartDisplay } = useContext(AppContext);
  const { defaultCurrency, rotateDefaultCurrency } = useContext(RatesContext);
  const [searchParams] = useSearchParams();

  const ref = useRef<HTMLDivElement>(null);
  const refToolTip = useRef<HTMLSpanElement>(null);
  const chart = useRef<IChartApi>();
  const chartInitialized = useRef(false);
  const lineSeries = useRef<ISeriesApi<'Area'>>();
  const formattedData = useRef<FormattedData>({});

  const [source, setSource] = useState<'daily' | 'hourly'>(chartDisplay === 'week' ? 'hourly' : 'daily');
  const [difference, setDifference] = useState<number>();
  const [diffSince, setDiffSince] = useState<string>();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [tooltipData, setTooltipData] = useState<{
    toolTipVisible: boolean;
    toolTipValue?: string;
    toolTipPercent?: string; // added percent
    toolTipTop: number;
    toolTipLeft: number;
    toolTipTime: number;
  }>({
    toolTipVisible: false,
    toolTipTop: 0,
    toolTipLeft: 0,
    toolTipTime: 0,
    toolTipPercent: undefined, // init
  });

  const [showPercent, setShowPercent] = useState(false);

  // Hilfsfunktion zum Filtern der Chart-Daten basierend auf showPercent
  const getFilteredChartData = useCallback((chartData: ChartData) => {
    return chartData.map(entry => ({
      ...entry,
      value: showPercent ? entry.percent : entry.amount // <-- Hier setzen wir value basierend auf showPercent
    }));
  }, [showPercent]);

  useEffect(() => {
    setTooltipData({
      toolTipVisible: false,
      toolTipTop: 0,
      toolTipLeft: 0,
      toolTipTime: 0,
    });
  }, [defaultCurrency]);

  const [showAnimationOverlay, setAnimationOverlay] = useState(true);

  const prevChartDataDaily = usePrevious(data.chartDataDaily);
  const prevChartDataHourly = usePrevious(data.chartDataHourly);
  const prevChartFiat = usePrevious(data.chartFiat);
  const prevHideAmounts = usePrevious(hideAmounts);
  const hasChartAnimationParam = searchParams.get('with-chart-animation');


  const setFormattedData = (chartData: ChartData) => {
    formattedData.current = {};

    chartData.forEach(entry => {
      if (formattedData.current) {
        formattedData.current[entry.time as number] = entry.formattedValue;
      }
    });
  };

  const displayWeek = () => {
    if (source !== 'hourly' && lineSeries.current && data.chartDataHourly && chart.current) {
      lineSeries.current.setData(getFilteredChartData(data.chartDataHourly || [])); // <-- Hier anwenden
      setFormattedData(data.chartDataHourly || []);
      chart.current.applyOptions({ timeScale: { timeVisible: true } });
    }
    setChartDisplay('week');
    setSource('hourly');
  };

  const displayMonth = () => {
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(getFilteredChartData(data.chartDataDaily || [])); // <-- Hier anwenden
      setFormattedData(data.chartDataDaily || []);
      chart.current.applyOptions({ timeScale: { timeVisible: false } });
    }
    setChartDisplay('month');
    setSource('daily');
  };

  const displayYear = () => {
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(getFilteredChartData(data.chartDataDaily)); // <-- Hier anwenden
      setFormattedData(data.chartDataDaily);
      chart.current.applyOptions({ timeScale: { timeVisible: false } });
    }
    setChartDisplay('year');
    setSource('daily');
  };

  const displayAll = () => {
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(getFilteredChartData(data.chartDataDaily)); // <-- Hier anwenden
      setFormattedData(data.chartDataDaily);
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
    const logicalrange = chart.current.timeScale().getVisibleLogicalRange() as LogicalRange;
    const visiblerange = lineSeries.current.barsInLogicalRange(logicalrange);
    if (!visiblerange) {
      return;
    }
    const rangeFrom = Math.max(Math.floor(visiblerange.barsBefore), 0);
    if (!chartData[rangeFrom]) {
      setDifference(0);
      setDiffSince('');
      return;
    }

    // Portfolio-Performance (bestehende Logik)
    const valueFrom = chartData[rangeFrom].value === 0 ? chartData[rangeFrom + 1].value : chartData[rangeFrom].value;
    const valueTo = data.chartTotal;
    const valueDiff = valueTo ? valueTo - valueFrom : 0;
    setDifference(valueDiff / valueFrom);

    setDiffSince(`${chartData[rangeFrom].formattedValue} (${renderDate(Number(chartData[rangeFrom].time) * 1000, i18n.language, source)})`);
  }, [data, i18n.language, source]);

  // Moved handleCrosshair before removeChart to satisfy hook dependencies
  const handleCrosshair = useCallback(({
    point,
    time,
    seriesData
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
      setTooltipData(td => ({ ...td, toolTipVisible: false }));
      return;
    }
    const price = seriesData.get(lineSeries.current) as LineData<Time>;
    const chartData = source === 'daily' ? data.chartDataDaily : data.chartDataHourly;
    const entry = chartData.find(e => Number(e.time) === time as number);
    const percentLabel = entry ? `${entry.percent.toFixed(2)}%` : '';
    const coordinate = lineSeries.current.priceToCoordinate(price.value);
    if (!coordinate) {
      return;
    }
    const y = coordinate - tooltip.clientHeight > 0 ? coordinate - tooltip.clientHeight : Math.max(0, Math.min(parent.clientHeight - tooltip.clientHeight, coordinate + 70));
    setTooltipData({
      toolTipVisible: true,
      toolTipValue: formattedData.current?.[time as number] || '',
      toolTipPercent: percentLabel,
      toolTipTop: Math.floor(y),
      toolTipLeft: Math.floor(Math.max(40, Math.min(parent.clientWidth - 140, point.x + 40 - 70))),
      toolTipTime: time as number,
    });
  }, [source, data.chartDataDaily, data.chartDataHourly]);

  const removeChart = useCallback(() => {
    if (chartInitialized.current) {
      chart.current?.timeScale().unsubscribeVisibleLogicalRangeChange(calculateChange);
      chart.current?.unsubscribeCrosshairMove(handleCrosshair);
      chart.current?.remove();
      chart.current = undefined;
      chartInitialized.current = false;
    }
  }, [calculateChange, handleCrosshair]);

  const initChart = useCallback(() => {
    const darkmode = getDarkmode();
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
            color: darkmode ? '#333333' : '#dedede',
            style: LineStyle.Solid,
            visible: !isMobile,
          },
        },
        layout: {
          background: {
            type: ColorType.Solid,
            color: darkmode ? '#1D1D1B' : '#F5F5F5',
          },
          fontSize: 11,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Roboto", "Oxygen", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          textColor: darkmode ? '#F5F5F5' : '#1D1D1B',
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
        priceFormat: {
          type: 'volume',
        },
        topColor: darkmode ? '#5E94BF' : '#DFF1FF',
        bottomColor: darkmode ? '#1D1D1B' : '#F5F5F5',
        lineColor: 'rgba(94, 148, 192, 1)',
        crosshairMarkerRadius: 6,
      });
      const isChartDisplayWeekly = chartDisplay === 'week';
      // Chart wird with diesen Daten initialisiert:
      lineSeries.current.setData(
        getFilteredChartData(
          isChartDisplayWeekly
            ? data.chartDataHourly
            : data.chartDataDaily
        )
      );
      setFormattedData(
        isChartDisplayWeekly
          ? data.chartDataHourly
          : data.chartDataDaily
      );
      chart.current.timeScale().subscribeVisibleLogicalRangeChange(calculateChange);
      chart.current.subscribeCrosshairMove(handleCrosshair);
      chart.current.timeScale().fitContent();
      ref.current?.classList.remove(styles.invisible);
      chartInitialized.current = true;
      updateRange(chart, chartDisplay);
    }
  }, [calculateChange, chartDisplay, data.chartDataDaily, data.chartDataHourly, data.chartDataMissing, hasData, hideAmounts, i18n.language, isMobile, getFilteredChartData, handleCrosshair]);

  const reinitializeChart = () => {
    removeChart();
    initChart();
  };

  if (source === 'daily' && prevChartDataDaily?.length !== data.chartDataDaily.length) {
    lineSeries.current?.setData(getFilteredChartData(data.chartDataDaily)); // <-- Hier anwenden
    chart.current?.timeScale().fitContent();
    setFormattedData(data.chartDataDaily);
  }

  if (source === 'hourly' && prevChartDataHourly?.length !== data.chartDataHourly.length) {
    lineSeries.current?.setData(getFilteredChartData(data.chartDataHourly)); // <-- Hier anwenden
    chart.current?.timeScale().fitContent();
    setFormattedData(data.chartDataHourly);
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

  const onTogglePercent = () => {
    setShowPercent(!showPercent);
  };

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

  const hasDifference = difference && Number.isFinite(difference);
  const disableFilters = !hasData || chartDataMissing;
  const disableWeeklyFilters = !hasHourlyData || chartDataMissing;
  const showMobileTotalValue = toolTipVisible && !!toolTipValue && isMobile;
  const chartFiltersProps = {
    display: chartDisplay,
    disableFilters,
    disableWeeklyFilters,
    onDisplayWeek: displayWeek,
    onDisplayMonth: displayMonth,
    onDisplayYear: displayYear,
    onDisplayAll: displayAll,
    showPercent,
    onTogglePercent,
  };

  const chartHeight = `${!isMobile ? height : mobileHeight}px`;

  // Compute last percent for summary
  const summaryData = source === 'daily' ? data.chartDataDaily : data.chartDataHourly;
  const lastEntry = summaryData.length > 0 ? summaryData[summaryData.length - 1] : undefined;
  const lastPercentFraction = lastEntry ? lastEntry.percent / 100 : undefined;

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
              hasDifference={showPercent ? lastPercentFraction !== undefined && Number.isFinite(lastPercentFraction) : !!hasDifference}
              difference={showPercent ? lastPercentFraction : difference}
              title={showPercent && lastEntry ? `${lastEntry.percent.toFixed(2)}%` : diffSince}
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
          ${styles.transitionDiv}
          ${showAnimationOverlay ? '' : styles.overlayRemove}`}
        />
      )}
      <div className={styles.chartCanvas} style={{ minHeight: chartHeight }}>
        {chartDataMissing ? (
          <div className={styles.chartUpdatingMessage} style={{ height: chartHeight }}>
            {t('chart.dataMissing')}
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
          hidden={!toolTipVisible || isMobile}>
          {toolTipValue !== undefined ? (
            <span>
              <h2 className={styles.toolTipValue}>
                <Amount amount={toolTipValue} unit={chartFiat} />
                {tooltipData.toolTipPercent && (
                  <span style={{ marginLeft: '8px', fontSize: '0.9em' }}>
                    ({tooltipData.toolTipPercent})
                  </span>
                )}
              </h2>
              <span className={styles.toolTipTime}>
                {renderDate(toolTipTime * 1000, i18n.language, source)}
              </span>
            </span>
          ) : null}
        </span>
      </div>
      {isMobile && <Filters {...chartFiltersProps} />}
    </section>
  );
};
