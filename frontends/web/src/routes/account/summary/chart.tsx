// SPDX-License-Identifier: Apache-2.0

import { MutableRefObject, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { createChart, IChartApi, LineData, LineStyle, LogicalRange, ISeriesApi, UTCTimestamp, MouseEventParams, ColorType, Time } from 'lightweight-charts';
import type { TChartData, ChartData, FormattedLineData } from '@/api/account';
import { usePrevious } from '@/hooks/previous';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Amount } from '@/components/amount/amount';
import { PercentageDiff } from './percentage-diff';
import { Filters } from './filters';
import { getDarkmode } from '@/components/darkmode/darkmode';
import { RatesContext } from '@/contexts/RatesContext';
import { AppContext, TChartDisplay } from '@/contexts/AppContext';
import { AmountUnit } from '@/components/amount/amount-with-unit';
import { triggerHapticFeedback } from '@/utils/transport-mobile';
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
  chartFiat: 'USD',
  chartTotal: null,
  formattedChartTotal: null,
  chartIsUpToDate: false,
  lastTimestamp: 0,
};

type FormattedData = {
  [key: number]: string;
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
  const lastHapticTime = useRef<number | null>(null);

  const [source, setSource] = useState<'daily' | 'hourly'>(chartDisplay === 'week' ? 'hourly' : 'daily');
  const [difference, setDifference] = useState<number>();
  const [diffSince, setDiffSince] = useState<string>();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [tooltipData, setTooltipData] = useState<{
    toolTipVisible: boolean;
    toolTipValue?: string;
    toolTipTop: number;
    toolTipLeft: number;
    toolTipTime: number;
  }>({
    toolTipVisible: false,
    toolTipTop: 0,
    toolTipLeft: 0,
    toolTipTime: 0,
  });

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
      formattedData.current[entry.time as number] = entry.formattedValue;
    });
  };

  const displayWeek = () => {
    if (source !== 'hourly' && lineSeries.current && data.chartDataHourly && chart.current) {
      lineSeries.current.setData(data.chartDataHourly || []);
      setFormattedData(data.chartDataHourly || []);
      chart.current.applyOptions({ timeScale: { timeVisible: true } });
    }
    setChartDisplay('week');
    setSource('hourly');
  };

  const displayMonth = () => {
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(data.chartDataDaily || []);
      setFormattedData(data.chartDataDaily || []);
      chart.current.applyOptions({ timeScale: { timeVisible: false } });
    }
    setChartDisplay('month');
    setSource('daily');
  };

  const displayYear = () => {
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(data.chartDataDaily);
      setFormattedData(data.chartDataDaily);
      chart.current.applyOptions({ timeScale: { timeVisible: false } });
    }
    setChartDisplay('year');
    setSource('daily');
  };

  const displayAll = () => {
    if (source !== 'daily' && lineSeries.current && data.chartDataDaily && chart.current) {
      lineSeries.current.setData(data.chartDataDaily);
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
    // data should always have at least two data points and when the first
    // value is 0 we take the next value as valueFrom to calculate valueDiff
    const nextValue = chartData[rangeFrom + 1] as FormattedLineData;
    const valueFrom = chartData[rangeFrom].value === 0 ? nextValue.value : chartData[rangeFrom].value;
    const valueTo = data.chartTotal;
    const valueDiff = valueTo ? valueTo - valueFrom : 0;
    setDifference(valueDiff / valueFrom);
    setDiffSince(`${chartData[rangeFrom].formattedValue} (${renderDate(Number(chartData[rangeFrom].time) * 1000, i18n.language, source)})`);
  }, [data, i18n.language, source]);

  const removeChart = useCallback(() => {
    if (chartInitialized.current) {
      chart.current?.timeScale().unsubscribeVisibleLogicalRangeChange(calculateChange);
      chart.current?.unsubscribeCrosshairMove(handleCrosshair);
      chart.current?.remove();
      chart.current = undefined;
      chartInitialized.current = false;
    }
  }, [calculateChange]);

  const handleCrosshair = ({
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
      setTooltipData((tooltipData) => ({
        ...tooltipData,
        toolTipVisible: false
      }));
      lastHapticTime.current = null;
      return;
    }
    const price = seriesData.get(lineSeries.current) as LineData<Time>;
    if (!price) {
      return;
    }

    const currentTime = time as number;
    if (lastHapticTime.current !== currentTime) {
      triggerHapticFeedback();
      lastHapticTime.current = currentTime;
    }
    const coordinate = lineSeries.current.priceToCoordinate(price.value);
    if (!coordinate) {
      return;
    }
    const coordinateY = (
      (coordinate - tooltip.clientHeight > 0)
        ? coordinate - tooltip.clientHeight
        : Math.max(
          0,
          Math.min(
            parent.clientHeight - tooltip.clientHeight,
            coordinate + 70
          )
        )
    );

    const toolTipTop = Math.floor(Math.max(coordinateY, 0));
    const toolTipLeft = Math.floor(Math.max(40, Math.min(parent.clientWidth - 140, point.x + 40 - 70)));

    setTooltipData({
      toolTipVisible: true,
      toolTipValue: formattedData.current ? formattedData.current[time as number] : '',
      toolTipTop,
      toolTipLeft,
      toolTipTime: time as number,
    });
  };

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
      const dataToDisplay = (
        isChartDisplayWeekly
          ? data.chartDataHourly
          : data.chartDataDaily
      );
      lineSeries.current.setData(dataToDisplay);
      setFormattedData(dataToDisplay);
      chart.current.timeScale().subscribeVisibleLogicalRangeChange(calculateChange);
      chart.current.subscribeCrosshairMove(handleCrosshair);
      chart.current.timeScale().fitContent();
      if (styles.invisible) {
        ref.current?.classList.remove(styles.invisible);
      }
      chartInitialized.current = true;
      updateRange(chart, chartDisplay);
    }
  }, [calculateChange, chartDisplay, data.chartDataDaily, data.chartDataHourly, data.chartDataMissing, hasData, hideAmounts, i18n.language, isMobile]);

  const reinitializeChart = () => {
    removeChart();
    initChart();
  };

  if (source === 'daily' && prevChartDataDaily?.length !== data.chartDataDaily.length) {
    lineSeries.current?.setData(data.chartDataDaily);
    chart.current?.timeScale().fitContent();
    setFormattedData(data.chartDataDaily);
  }

  if (source === 'hourly' && prevChartDataHourly?.length !== data.chartDataHourly.length) {
    lineSeries.current?.setData(data.chartDataHourly);
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
  };

  const chartHeight = `${!isMobile ? height : mobileHeight}px`;

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
          <div className={styles.chartUpdatingMessage} style={{ height: chartHeight }}>
            <p>
              {t('chart.dataMissing')}
            </p>
          </div>
        ) : hasData ? !chartIsUpToDate && (
          <div className={styles.chartUpdatingMessage}>
            {t('chart.dataOldTimestamp', {
              time: new Date(lastTimestamp).toLocaleString(i18n.language)
            })}
          </div>
        ) : (
          <div className={styles.placeholderContainer}>
            <p>
              {noDataPlaceholder}
            </p>
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
                <span className={styles.toolTipUnit}>{chartFiat}</span>
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
