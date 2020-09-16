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

import { createChart, IChartApi } from 'lightweight-charts';
import { Component, createRef, h, RenderableProps } from 'preact';

interface ChartProps {
}

interface State {
}

type Props = ChartProps;

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
            const lineSeries = this.chart.addLineSeries();
            lineSeries.setData([
                { time: '2019-04-11', value: 80.01 },
                { time: '2019-04-12', value: 96.63 },
                { time: '2019-04-13', value: 76.64 },
                { time: '2019-04-14', value: 81.89 },
                { time: '2019-04-15', value: 74.43 },
                { time: '2019-04-16', value: 80.01 },
                { time: '2019-04-17', value: 96.63 },
                { time: '2019-04-18', value: 76.64 },
                { time: '2019-04-19', value: 81.89 },
                { time: '2019-04-20', value: 74.43 },
            ]);

            window.addEventListener('resize', this.onResize);
        }
    }

    public componentWillUnmount() {
        window.removeEventListener('resize', this.onResize);
    }

    public render(
        { }: RenderableProps<Props>,
        { }: State,
    ) {
        return (
            <div ref={this.ref}></div>
        );
    }
}

export { Chart };
