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

import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { subscribe } from '../../decorators/subscribe';
import * as style from './headerssync.css';

@translate()
// @ts-ignore (generics need to be typed explicitly once converted to TypeScript)
@subscribe(props => ({ status: 'coins/' + props.coinCode + '/headers/status' }))
export default class HeadersSync extends Component {
    constructor(props) {
        super(props);
        this.state = { show: 0 };
    }

    componentDidUpdate(prevProps) {
        const status = this.props.status;
        if (status && prevProps.status && status.tip !== prevProps.status.tip) {
            this.setState({ show: status.tip }); // eslint-disable-line
            if (status.tip === status.targetHeight) {
                setTimeout(() => this.setState(state => state.show === status.tip && { show: 0 }), 4000);
            }
        }
    }

    render({
        t,
        status,
    }, {
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
            <div className={style.syncContainer}>
                <div className={style.syncMessage}>
                    <div className={style.syncText}>
                        {t('headerssync.blocksSynced', { blocks: formatted })} { !loaded && `(${Math.ceil(value)}%)` }
                    </div>
                    {
                        !loaded && (
                            <div className={style.spinnerContainer}>
                                <div className={style.spinner}></div>
                            </div>
                        )
                    }
                </div>
                <div className={style.progressBar}>
                    <div className={style.progressValue} style={{ width: `${value}%` }}></div>
                </div>
            </div>
        );
    }
}
