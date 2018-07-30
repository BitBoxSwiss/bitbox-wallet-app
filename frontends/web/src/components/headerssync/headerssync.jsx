/**
 * Copyright 2018 Shift Devices AG
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

import { translate } from 'react-i18next';
import UpdatingComponent from '../updating/updating';
import style from './headerssync.css';

@translate()
export default class HeadersSync extends UpdatingComponent {
    constructor(props) {
        super(props);
        this.state = { show: 0 };
    }

    getStateMap() {
        return { status: 'coins/' + this.props.coinCode + '/headers/status' };
    }

    componentDidUpdate(prevProps, prevState) {
        super.componentDidUpdate(prevProps);
        const status = this.state.status;
        if (status && prevState.status && status.tip !== prevState.status.tip) {
            this.setState({ show: status.tip }); // eslint-disable-line
            if (status.tip === status.targetHeight) {
                setTimeout(() => this.setState(state => state.show === status.tip && { show: 0 }), 4000);
            }
        }
    }

    render({
        t
    }, {
        status,
        show,
    }) {
        if (!status || !show) {
            return null;
        }

        const total = status.targetHeight - status.tipAtInitTime;
        const value = 100 * (status.tip - status.tipAtInitTime) / total;
        const loaded = !total || value >= 100;

        let formatted = status.tip.toString();
        let position = formatted.length - 3;
        while (position > 0) {
            formatted = formatted.slice(0, position) + "'" + formatted.slice(position);
            position = position - 3;
        }

        return (
            <div class={style.syncContainer}>
                <div class={style.syncMessage}>
                    <div class={style.syncText}>
                        {formatted} {t('headerssync.blocksSynced')} { !loaded && `(${Math.ceil(value)}%)` }
                    </div>
                    {
                        !loaded && (
                            <div class={style.spinnerContainer}>
                                <div class={style.spinner}></div>
                            </div>
                        )
                    }
                </div>
                <div class={style.progressBar}>
                    <div class={style.progressValue} style={{ width: `${value}%` }}></div>
                </div>
            </div>
        );
    }
}
