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

import { createChart, IChartApi, LineData, LineStyle, LogicalRange, ISeriesApi, UTCTimestamp, MouseEventParams, ColorType, Time } from 'lightweight-charts';
import { Component, createRef, ReactChild } from 'react';
import { ISummary } from '../../../api/account';
import { translate, TranslateProps } from '../../../decorators/translate';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { Amount } from '../../../components/amount/amount';
import { PercentageDiff } from './percentage-diff';
import { Filters } from './filters';
import { getDarkmode } from '../../../components/darkmode/darkmode';
import { TChartFiltersProps } from './types';
import { DefaultCurrencyRotator } from '../../../components/rates/rates';
import { AppContext } from '../../../contexts/AppContext';
import styles from './chart.module.css';

export interface FormattedLineData extends LineData {
  formattedValue: string;
}

export type ChartData = FormattedLineData[];

type ChartProps = {
  data: ISummary;
  noDataPlaceholder?: ReactChild;
  hideAmounts: boolean;
};

type State = {
  source: 'daily' | 'hourly';
  difference?: number;
  diffSince?: string;
  toolTipVisible: boolean;
  toolTipValue?: string;
  toolTipTop: number;
  toolTipLeft: number;
  toolTipTime: number;
  isMobile: boolean;
}

type Props = ChartProps & TranslateProps;

type FormattedData = {
  [key: number]: string;
}
class Chart extends Component<Props, State> {
  static contextType = AppContext;
  context!: React.ContextType<typeof AppContext>;
  private ref = createRef<HTMLDivElement>();
  private refToolTip = createRef<HTMLSpanElement>();
  private chart?: IChartApi;
  private lineSeries?: ISeriesApi<'Area'>;
  private height: number = 300;
  private mobileHeight: number = 150;
  private formattedData?: FormattedData;

  static readonly defaultProps: ChartProps = {
    data: {
      chartDataMissing: true,
      chartDataDaily: [],
      chartDataHourly: [],
      chartFiat: 'USD',
      chartTotal: null,
      formattedChartTotal: null,
      chartIsUpToDate: false,
      lastTimestamp: 0,
    },
    hideAmounts: false,
  };

  public readonly state: State = {
    source: 'daily',
    toolTipVisible: false,
    toolTipValue: undefined,
    toolTipTop: 0,
    toolTipLeft: 0,
    toolTipTime: 0,
    isMobile: false,
  };

  public componentDidMount() {
    if (this.state.source !== 'hourly' && this.context.chartDisplay === 'week') {
      this.setState({ source: 'hourly' });
    }
    this.createChart();
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    if (this.chart) {
      this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.calculateChange);
      this.chart.unsubscribeCrosshairMove(this.handleCrosshair);
    }
  }

  public componentDidUpdate(prev: Props) {
    const { chartDataDaily, chartDataHourly } = this.props.data;
    if (!this.chart) {
      this.createChart();
    }
    if (
      (this.lineSeries && prev.data.chartDataDaily && prev.data.chartDataHourly && chartDataDaily && chartDataHourly)
        && (
          prev.data.chartDataDaily.length !== chartDataDaily.length
          || prev.data.chartDataHourly.length !== chartDataHourly.length
        )
    ) {
      const data = this.state.source === 'hourly' ? chartDataHourly : chartDataDaily;
      this.lineSeries.setData(data);
      this.chart?.timeScale().fitContent();
      this.setFormattedData(data);
    }

    if (prev.hideAmounts !== this.props.hideAmounts) {
      this.chart?.applyOptions({
        leftPriceScale: {
          visible: this.props.hideAmounts ? false : !this.state.isMobile,
        }
      });
    }

    if (this.props.data.chartFiat !== prev.data.chartFiat) {
      this.reinitializeChart();
    }
  }

  private hasData = (): boolean => {
    return this.props.data.chartDataDaily && this.props.data.chartDataDaily.length > 0;
  };

  private hasHourlyData = (): boolean => {
    return this.props.data.chartDataHourly && this.props.data.chartDataHourly.length > 0;
  };

  private setFormattedData(data: ChartData) {
    this.formattedData = {} as FormattedData;

    data.forEach(entry => {
      if (this.formattedData) {
        this.formattedData[entry.time as number] = entry.formattedValue;
      }
    });
  }

  private createChart = () => {
    const { data: { chartDataMissing } } = this.props;
    const darkmode = getDarkmode();
    if (this.ref.current && this.hasData() && !chartDataMissing) {
      if (!this.chart) {
        const isMobile = window.innerWidth <= 640;
        this.setState({ isMobile });
        const chartWidth = !isMobile ? this.ref.current.offsetWidth : document.body.clientWidth;
        const chartHeight = !isMobile ? this.height : this.mobileHeight;
        this.chart = createChart(this.ref.current, {
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
            visible: this.props.hideAmounts ? false : !isMobile,
            entireTextOnly: true,
          },
          localization: {
            locale: this.props.i18n.language,
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
      }
      this.lineSeries = this.chart.addAreaSeries({
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
      switch (this.context.chartDisplay) {
      case 'week':
        this.displayWeek();
        break;
      case 'month':
        this.displayMonth();
        break;
      case 'year':
        this.displayYear();
        break;
      }
      const isChartDisplayWeekly = this.context.chartDisplay === 'week';
      this.lineSeries.setData(
        (isChartDisplayWeekly ?
          this.props.data.chartDataHourly :
          this.props.data.chartDataDaily) as ChartData
      );
      this.setFormattedData(
        (isChartDisplayWeekly ?
          this.props.data.chartDataHourly :
          this.props.data.chartDataDaily) as ChartData
      );
      this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.calculateChange);
      this.chart.subscribeCrosshairMove(this.handleCrosshair);
      this.chart.timeScale().fitContent();
      window.addEventListener('resize', this.onResize);
      this.ref.current?.classList.remove(styles.invisible);
    }
  };

  private reinitializeChart = () => {
    this.removeChart();
    this.createChart();
  };

  private removeChart = () => {
    if (this.chart) {
      this.chart.remove();
      this.chart = undefined;
      window.removeEventListener('resize', this.onResize);
    }
  };

  private onResize = () => {
    const isMobile = window.innerWidth <= 640;
    this.setState({ isMobile });
    if (!this.chart || !this.ref.current) {
      return;
    }
    const chartWidth = !isMobile ? this.ref.current.offsetWidth : document.body.clientWidth;
    const chartHeight = !isMobile ? this.height : this.mobileHeight;
    this.chart.resize(chartWidth, chartHeight);
    this.chart.applyOptions({
      grid: {
        horzLines: {
          visible: !isMobile
        }
      },
      timeScale: {
        visible: !isMobile
      },
      leftPriceScale: {
        visible: this.props.hideAmounts ? false : !isMobile,
      },
    });
    this.chart.timeScale().fitContent();
  };

  private getUTCRange = () => {
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

  private displayWeek = () => {
    if (this.state.source !== 'hourly' && this.lineSeries && this.props.data.chartDataHourly && this.chart) {
      this.lineSeries.setData(this.props.data.chartDataHourly || []);
      this.setFormattedData(this.props.data.chartDataHourly || []);
      this.chart.applyOptions({ timeScale: { timeVisible: true } });
    }
    this.context.setChartDisplay('week');
    this.setState(
      { source: 'hourly' },
      () => {
        if (!this.chart) {
          return;
        }
        const { utcDate, from, to } = this.getUTCRange();
        from.setUTCDate(utcDate - 7);
        this.chart.timeScale().setVisibleRange({
          from: from.getTime() / 1000 as UTCTimestamp,
          to: to.getTime() / 1000 as UTCTimestamp,
        });
      }
    );
  };

  private displayMonth = () => {
    if (this.state.source !== 'daily' && this.lineSeries && this.props.data.chartDataDaily && this.chart) {
      this.lineSeries.setData(this.props.data.chartDataDaily || []);
      this.setFormattedData(this.props.data.chartDataDaily || []);
      this.chart.applyOptions({ timeScale: { timeVisible: false } });
    }
    this.context.setChartDisplay('month');
    this.setState(
      { source: 'daily' },
      () => {
        if (!this.chart) {
          return;
        }
        const { utcMonth, from, to } = this.getUTCRange();
        from.setUTCMonth(utcMonth - 1);
        this.chart.timeScale().setVisibleRange({
          from: from.getTime() / 1000 as UTCTimestamp,
          to: to.getTime() / 1000 as UTCTimestamp,
        });
      }
    );
  };

  private displayYear = () => {
    if (this.state.source !== 'daily' && this.lineSeries && this.props.data.chartDataDaily && this.chart) {
      this.lineSeries.setData(this.props.data.chartDataDaily);
      this.setFormattedData(this.props.data.chartDataDaily);
      this.chart.applyOptions({ timeScale: { timeVisible: false } });
    }
    this.context.setChartDisplay('year');
    this.setState(
      { source: 'daily' },
      () => {
        if (!this.chart) {
          return;
        }
        const { utcYear, from, to } = this.getUTCRange();
        from.setUTCFullYear(utcYear - 1);
        this.chart && this.chart.timeScale().setVisibleRange({
          from: from.getTime() / 1000 as UTCTimestamp,
          to: to.getTime() / 1000 as UTCTimestamp,
        });
      }
    );
  };

  private displayAll = () => {
    if (this.state.source !== 'daily' && this.lineSeries && this.props.data.chartDataDaily && this.chart) {
      this.lineSeries.setData(this.props.data.chartDataDaily);
      this.setFormattedData(this.props.data.chartDataDaily);
      this.chart.applyOptions({ timeScale: { timeVisible: false } });
    }
    this.context.setChartDisplay('all');
    this.setState(
      { source: 'daily' },
      () => {
        if (!this.chart) {
          return;
        }
        this.chart.timeScale().fitContent();
      }
    );
  };

  private calculateChange = () => {
    const data = this.props.data[this.state.source === 'daily' ? 'chartDataDaily' : 'chartDataHourly'];
    if (!data || !this.chart || !this.lineSeries) {
      return;
    }
    const logicalrange = this.chart.timeScale().getVisibleLogicalRange() as LogicalRange;
    const visiblerange = this.lineSeries.barsInLogicalRange(logicalrange);
    if (!visiblerange) {
      // if the chart is empty, during first load, barsInLogicalRange is null
      return;
    }
    const rangeFrom = Math.max(Math.floor(visiblerange.barsBefore), 0);
    if (!data[rangeFrom]) {
      // when data series have changed it triggers subscribeVisibleLogicalRangeChange
      // but at this point the setVisibleRange has not executed what the new range
      // should be and therefore barsBefore might still point to the old range
      // so we have to ignore this call and expect setVisibleRange with correct range
      this.setState({ difference: 0, diffSince: '' });
      return;
    }
    // data should always have at least two data points and when the first
    // value is 0 we take the next value as valueFrom to calculate valueDiff
    const valueFrom = data[rangeFrom].value === 0 ? data[rangeFrom + 1].value : data[rangeFrom].value;
    const valueTo = this.props.data.chartTotal;
    const valueDiff = valueTo ? valueTo - valueFrom : 0;
    this.setState({
      difference: ((valueDiff / valueFrom)),
      diffSince: `${data[rangeFrom].formattedValue} (${this.renderDate(Number(data[rangeFrom].time) * 1000)})`
    });
  };

  private handleCrosshair = ({ point, time, seriesData }: MouseEventParams) => {
    if (!this.refToolTip.current) {
      return;
    }
    const tooltip = this.refToolTip.current;
    const parent = tooltip.parentNode as HTMLDivElement;
    if (
      !this.lineSeries || !point || !time
            || point.x < 0 || point.x > parent.clientWidth
            || point.y < 0 || point.y > parent.clientHeight
    ) {
      this.setState({
        toolTipVisible: false
      });
      return;
    }
    const price = seriesData.get(this.lineSeries) as LineData<Time>;
    if (!price) {
      return;
    }
    const coordinate = this.lineSeries.priceToCoordinate(price.value);
    if (!coordinate) {
      return;
    }
    const coordinateY =
      (coordinate - tooltip.clientHeight > 0)
        ? coordinate - tooltip.clientHeight
        : Math.max(
          0,
          Math.min(
            parent.clientHeight - tooltip.clientHeight,
            coordinate + 70
          )
        );

    const toolTipTop = Math.floor(Math.max(coordinateY, 0));
    const toolTipLeft = Math.floor(Math.max(40, Math.min(parent.clientWidth - 140, point.x + 40 - 70)));

    this.setState({
      toolTipVisible: true,
      toolTipValue: this.formattedData ? this.formattedData[time as number] : '',
      toolTipTop,
      toolTipLeft,
      toolTipTime: time as number,
    });
  };

  private renderDate = (date: number) => {
    return new Date(date).toLocaleString(
      this.props.i18n.language,
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(this.state.source === 'hourly' ? {
          hour: '2-digit',
          minute: '2-digit',
        } : null)
      }
    );
  };

  public render() {
    const {
      t,
      data: {
        lastTimestamp,
        chartDataMissing,
        chartFiat,
        chartIsUpToDate,
        chartTotal,
        formattedChartTotal,
      },
      noDataPlaceholder,
    } = this.props;
    const {
      difference,
      diffSince,
      toolTipVisible,
      toolTipValue,
      toolTipTop,
      toolTipLeft,
      toolTipTime,
      isMobile
    } = this.state;
    const hasDifference = difference && Number.isFinite(difference);
    const hasData = this.hasData();
    const hasHourlyData = this.hasHourlyData();
    const disableFilters = !hasData || chartDataMissing;
    const disableWeeklyFilters = !hasHourlyData || chartDataMissing;
    const showMobileTotalValue = toolTipVisible && !!toolTipValue && isMobile;
    const chartFiltersProps = {
      display: this.context.chartDisplay,
      disableFilters,
      disableWeeklyFilters,
      onDisplayWeek: this.displayWeek,
      onDisplayMonth: this.displayMonth,
      onDisplayYear: this.displayYear,
      onDisplayAll: this.displayAll,
    } as TChartFiltersProps;
    const chartHeight = `${!isMobile ? this.height : this.mobileHeight}px`;
    return (
      <section className={styles.chart}>
        <header>
          <div className={styles.summary}>
            <div className={styles.totalValue}>
              {formattedChartTotal !== null ? (
                // remove trailing zeroes for BTC fiat total
                <Amount amount={!showMobileTotalValue ? formattedChartTotal : toolTipValue} unit={chartFiat} removeBtcTrailingZeroes/>
              ) : (
                <Skeleton minWidth="220px" />
              )}
              <span className={styles.totalUnit}>
                {chartTotal !== null && <DefaultCurrencyRotator tableRow={false}/>}
              </span>
            </div>
            {!showMobileTotalValue ? (
              <PercentageDiff
                hasDifference={!!hasDifference}
                difference={difference}
                title={diffSince}
              />
            ) :
              <span className={styles.diffValue}>
                {this.renderDate(toolTipTime * 1000)}
              </span>
            }
          </div>
          {!isMobile && <Filters {...chartFiltersProps} />}
        </header>
        <div className={styles.chartCanvas} style={{ minHeight: chartHeight }}>
          {chartDataMissing ? (
            <div className={styles.chartUpdatingMessage} style={{ height: chartHeight }}>
              {t('chart.dataMissing')}
            </div>
          ) : hasData ? !chartIsUpToDate && (
            <div className={styles.chartUpdatingMessage}>
              {t('chart.dataOldTimestamp', { time: new Date(lastTimestamp).toLocaleString(this.props.i18n.language), })}
            </div>
          ) : noDataPlaceholder}
          <div ref={this.ref} className={styles.invisible}></div>
          <span
            ref={this.refToolTip}
            className={styles.tooltip}
            style={{ left: toolTipLeft, top: toolTipTop }}
            hidden={!toolTipVisible || isMobile}>
            {toolTipValue !== undefined ? (
              <span>
                <h2 className={styles.toolTipValue}>
                  <Amount amount={toolTipValue} unit={chartFiat}/>
                  <span className={styles.toolTipUnit}>{chartFiat}</span>
                </h2>
                <span className={styles.toolTipTime}>
                  {this.renderDate(toolTipTime * 1000)}
                </span>
              </span>
            ) : null}
          </span>
        </div>
        {isMobile && <Filters {...chartFiltersProps} />}
      </section>
    );
  }
}


const HOC = translate()(Chart);

export { HOC as Chart };
