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

import { createChart, IChartApi, LineData } from 'lightweight-charts';
import { Component, createRef, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../../decorators/translate';

export type ChartData = LineData[];

interface ChartProps {
    // If undefined, data is missing.
    data?: ChartData;
}

interface State {
}

type Props = ChartProps & TranslateProps;

class Chart extends Component<Props, State> {
    private ref = createRef();
    private chart?: IChartApi;
    private resizeTimerID?: any;
    private height: number = 300;

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

    public componentDidMount() {
        if (this.ref.current) {
            this.chart = createChart(this.ref.current, {
                width: this.ref.current.offsetWidth,
                height: this.height,
            });
            if (this.props.data !== undefined) {
                const lineSeries = this.chart.addLineSeries();
                lineSeries.setData(this.props.data);
            }
            this.chart.timeScale().fitContent();
            window.addEventListener('resize', this.onResize);
        }
    }

    public componentWillUnmount() {
        window.removeEventListener('resize', this.onResize);
    }

    public render(
        { t, data }: RenderableProps<Props>,
        { }: State,
    ) {
        return (
            <div>
                { data === undefined && (
                      <div>{t('chart.dataMissing')}</div>
                )}
                <div ref={this.ref}></div>
            </div>
        );
    }
}

const HOC = translate<ChartProps>()(Chart);

export { HOC as Chart };
