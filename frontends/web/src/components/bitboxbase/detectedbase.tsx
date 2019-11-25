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

import { Component, h, RenderableProps} from 'preact';
import { translate, TranslateProps } from '../../decorators/translate';
import * as style from './bitboxbase.css';

interface DetectedBaseProps {
    ip: string;
    hostname: string;
    connect: (ip: string) => void;
}

type Props = DetectedBaseProps & TranslateProps;

class DetectedBase extends Component<Props> {
    constructor(props) {
        super(props);
    }

    private handleConnect = () => {
        const { connect, ip } = this.props;
        connect(ip);
    }

    public render(
        {
            // t,
            hostname,
            ip,
        }: RenderableProps<Props>,
    ) {
        return (
            <div className={style.baseItem}>
                <div className={[style.baseItemSortable, style.detected].join(' ')}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </div>
                <span className={style.baseItemName}>
                    <a className={style.baseItemName} onClick={this.handleConnect}>{hostname}</a>
                    <p className={[style.baseItemIp, 'm-none', 'show-on-small'].join(' ')}>{ip}</p>
                </span>
                <span className={[style.baseItemIp, 'hide-on-small'].join(' ')}>{ip}</span>
                <a className={[style.baseItemArrow, style.autoLeft].join(' ')} onClick={this.handleConnect}>
                    <span>Uninitialized</span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </a>
            </div>
        );
    }
}

const HOC = translate<DetectedBaseProps>()(DetectedBase);
export { HOC as DetectedBase};
