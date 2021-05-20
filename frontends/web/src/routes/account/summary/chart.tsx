/**
 * Copyright 2020 Shift Crypto AG
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

import { createChart, IChartApi, BarsInfo, LineData, LineStyle, LogicalRange, ISeriesApi, UTCTimestamp, MouseEventHandler } from 'lightweight-charts';
import { Component, createRef, h, RenderableProps } from 'preact';
import { Fiat } from '../../../api/account';
import { translate, TranslateProps } from '../../../decorators/translate';
import { formatCurrency, formatNumber } from '../../../components/rates/rates';
import * as styles from './chart.css';

export type ChartData = LineData[];

interface ChartProps {
    // If undefined, data is missing.
    dataDaily?: ChartData;
    dataHourly?: ChartData;
    fiatUnit: Fiat;
    total: number | null;
    isUpToDate: boolean;
}

interface State {
    display: 'week' | 'month' | 'year' | 'all';
    source: 'daily' | 'hourly';
    difference?: number;
    diffSince?: string;
    toolTipVisible: boolean;
    toolTipValue?: number;
    toolTipTop: number;
    toolTipLeft: number;
    toolTipTime: number;
}

type Props = ChartProps & TranslateProps;

class Chart extends Component<Props, State> {
    private ref = createRef();
    private refToolTip = createRef();
    private chart?: IChartApi;
    private lineSeries?: ISeriesApi<'Area'>;
    private resizeTimerID?: any;
    private height: number = 300;

    public readonly state: State = {
        display: 'all',
        source: 'daily',
        toolTipVisible: false,
        toolTipValue: undefined,
        toolTipTop: 0,
        toolTipLeft: 0,
        toolTipTime: 0,
    };

    public componentDidMount() {
        this.createChart();
    }

    public componentWillUnmount() {
        window.removeEventListener('resize', this.onResize);
        if (this.chart) {
            this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.calculateChange);
            this.chart.unsubscribeCrosshairMove(this.handleCrosshair as MouseEventHandler);
        }
    }

    public componentDidUpdate(prev) {
        const { dataDaily, dataHourly } = this.props;
        if (!this.chart) {
            this.createChart();
        }
        if (
            (this.lineSeries && prev.dataDaily && prev.dataHourly && dataDaily && dataHourly)
            && (
                prev.dataDaily.length !== dataDaily.length
                || prev.dataHourly.length !== dataHourly.length
            )
        ) {
            const data = this.state.source === 'hourly' ? dataHourly : dataDaily;
            this.lineSeries.setData(data);
        }
    }

    private hasData = () => {
        return this.props.dataDaily && this.props.dataDaily.length;
    }

    private createChart = () => {
        if (this.ref.current && this.hasData()) {
            if (!this.chart) {
                this.chart = createChart(this.ref.current, {
                    width: this.ref.current.offsetWidth,
                    height: this.height,
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
                            color: '#dedede',
                            style: LineStyle.Solid,
                            visible: true,
                        },
                    },
                    layout: {
                        backgroundColor: '#F5F5F5',
                        fontSize: 11,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Roboto", "Oxygen", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                        textColor: '#1D1D1B',
                    },
                    leftPriceScale: {
                        borderVisible: false,
                        drawTicks: false,
                        visible: true,
                        entireTextOnly: true,
                    },
                    localization: {
                        locale: this.props.i18n.language,
                    },
                    rightPriceScale: {
                        visible: false,
                        drawTicks: false,
                    },
                    timeScale: {
                        borderVisible: false,
                        timeVisible: false,
                    }
                });
            }
            this.lineSeries = this.chart.addAreaSeries({
                priceLineVisible: false,
                lastValueVisible: false,
                priceFormat: {
                    type: 'volume',
                },
                topColor: 'rgba(94, 148, 192, 0.5)',
                bottomColor: 'rgba(94, 148, 192, 0.02)',
                lineColor: 'rgba(94, 148, 192, 1)',
                crosshairMarkerRadius: 6,
            });
            this.lineSeries.setData(this.props.dataDaily as ChartData);
            this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.calculateChange);
            this.chart.subscribeCrosshairMove(this.handleCrosshair as MouseEventHandler);
            this.chart.timeScale().fitContent();
            window.addEventListener('resize', this.onResize);
            setTimeout(() => this.ref.current?.classList.remove(styles.invisible), 200);
        }
    }

    private onResize = () => {
        if (this.resizeTimerID) {
            clearTimeout(this.resizeTimerID);
        }
        this.resizeTimerID = setTimeout(() => {
            if (!this.chart || !this.ref.current) {
                return;
            }
            this.chart.resize(this.ref.current.offsetWidth, this.height);
        }, 200);
    }

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
    }

    private displayWeek = () => {
        if (this.state.source !== 'hourly' && this.lineSeries && this.props.dataHourly && this.chart) {
            this.lineSeries.setData(this.props.dataHourly);
            this.chart.applyOptions({ timeScale: { timeVisible: true } });
        }
        this.setState(
            { display: 'week', source: 'hourly' },
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
    }

    private displayMonth = () => {
        if (this.state.source !== 'daily' && this.lineSeries && this.props.dataDaily && this.chart) {
            this.lineSeries.setData(this.props.dataDaily);
            this.chart.applyOptions({ timeScale: { timeVisible: false } });
        }
        this.setState(
            { display: 'month', source: 'daily' },
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
    }

    private displayYear = () => {
        if (this.state.source !== 'daily' && this.lineSeries && this.props.dataDaily && this.chart) {
            this.lineSeries.setData(this.props.dataDaily);
            this.chart.applyOptions({ timeScale: { timeVisible: false } });
        }
        this.setState(
            { display: 'year', source: 'daily' },
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
    }

    private displayAll = () => {
        if (this.state.source !== 'daily' && this.lineSeries && this.props.dataDaily && this.chart) {
            this.lineSeries.setData(this.props.dataDaily);
            this.chart.applyOptions({ timeScale: { timeVisible: false } });
        }
        this.setState(
            { display: 'all', source: 'daily' },
            () => {
                if (!this.chart) {
                    return;
                }
                this.chart.timeScale().fitContent();
            }
        );
    }

    private calculateChange = () => {
        const data = this.props[this.state.source === 'daily' ? 'dataDaily' : 'dataHourly'];
        if (!data || !this.chart || !this.lineSeries) {
            return;
        }
        const logicalrange = this.chart.timeScale().getVisibleLogicalRange() as LogicalRange;
        const visiblerange = this.lineSeries.barsInLogicalRange(logicalrange) as BarsInfo;
        if (!visiblerange) {
            // if the chart is empty, during first load, barsInLogicalRange is null
            return;
        }
        const rangeFrom = Math.max(Math.floor(visiblerange.barsBefore), 0);
        if (!data[rangeFrom]){
            // when data series have changed it triggers subscribeVisibleLogicalRangeChange
            // but at this point the setVisibleRange has not executed what the new range
            // should be and therefore barsBefore might still point to the old range
            // so we have to ignore this call and expect setVisibleRange with correct range
            this.setState({ difference: 0, diffSince: '' });
            return;
        }
        const valueFrom = data[rangeFrom].value;
        const valueTo = this.props.total;
        const valueDiff = valueTo ? valueTo - valueFrom : 0;
        this.setState({
            difference: ((valueDiff / valueFrom) * 100),
            diffSince: `${data[rangeFrom].value.toFixed(2)} (${this.renderDate(Number(data[rangeFrom].time) * 1000)})`
        });
    }

    private handleCrosshair = ({ point, time, seriesPrices }) => {
        if (!this.refToolTip) {
            return;
        }
        const tooltip = this.refToolTip.current;
        const parent = tooltip.parentNode;
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
        const price = seriesPrices.get(this.lineSeries);
        const coordinate = this.lineSeries.priceToCoordinate(price);
        if (!coordinate) {
            return;
        }
        const toolTipTop = Math.max(coordinate - 70, 0);
        const toolTipLeft =  Math.max(40, Math.min(parent.clientWidth - 140, point.x + 40 - 70));
        this.setState({
            toolTipVisible: true,
            toolTipValue: price,
            toolTipTop,
            toolTipLeft,
            toolTipTime: time,
        });
    }

    private renderDate = (date) => {
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
    }

    public render(
        { t, dataDaily, fiatUnit, isUpToDate, total }: RenderableProps<Props>,
        {
            difference,
            diffSince,
            display,
            toolTipVisible,
            toolTipValue,
            toolTipTop,
            toolTipLeft,
            toolTipTime,
        }: State,
    ) {
        if (dataDaily === undefined) {
            return (
                <p className={styles.chartUpdatingMessage}>
                    {t('chart.dataMissing')}
                </p>
            );
        }
        const diff = difference && Number.isFinite(difference) ? (
            <span className={styles[difference < 0 ? 'down' : 'up']} title={diffSince}>
                <span className={styles.arrow}>
                    {difference < 0 ? (<ArrowUp />) : (<ArrowDown />)}
                </span>
                <span className={styles.diffValue}>
                    {formatNumber(difference, 2)}
                    <span className={styles.diffUnit}>%</span>
                </span>
            </span>
        ) : null;

        return (
            <section className={styles.chart}>
                <header>
                    <div className={styles.summary}>
                        {total ? (
                            <div className={styles.totalValue}>
                                {formatCurrency(total, fiatUnit)}
                                <span className={styles.totalUnit}>{fiatUnit}</span>
                            </div>
                        ) : null}
                        {diff}
                    </div>
                    { this.hasData() ? (
                        <div className={styles.filters}>
                            <button className={display === 'week' ? styles.filterActive : undefined} onClick={this.displayWeek}>
                                {t('chart.filter.week')}
                            </button>
                            <button className={display === 'month' ? styles.filterActive : undefined} onClick={this.displayMonth}>
                                {t('chart.filter.month')}
                            </button>
                            <button className={display === 'year' ? styles.filterActive : undefined} onClick={this.displayYear}>
                                {t('chart.filter.year')}
                            </button>
                            <button className={display === 'all' ? styles.filterActive : undefined} onClick={this.displayAll}>
                                {t('chart.filter.all')}
                            </button>
                        </div>
                    ) : null }
                </header>
                <div className={styles.chartCanvas}>
                    <div className={styles.chartUpdatingMessage}>
                        {!isUpToDate ? t('chart.dataUpdating') : null}
                    </div>
                    <div ref={this.ref} className={styles.invisible}></div>
                    <span
                        ref={this.refToolTip}
                        className={styles.tooltip}
                        style={`left: ${toolTipLeft}px; top: ${toolTipTop}px;`}
                        hidden={!toolTipVisible}>
                        {toolTipValue !== undefined ? (
                            <span>
                                <h2 className={styles.toolTipValue}>
                                    {formatCurrency(toolTipValue, fiatUnit)}
                                    <span className={styles.toolTipUnit}>{fiatUnit}</span>
                                </h2>
                                <span className={styles.toolTipTime}>
                                    {this.renderDate(toolTipTime * 1000)}
                                </span>
                            </span>
                        ): null}
                    </span>
                </div>
            </section>
        );
    }
}

const HOC = translate<ChartProps>()(Chart);

export { HOC as Chart };

export const ArrowUp = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
    </svg>
);

export const ArrowDown = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
    </svg>
);
