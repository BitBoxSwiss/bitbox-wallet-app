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
import { apiGet, apiPost } from '../../utils/request';
import * as style from './status.css';

export default class Status extends Component {
    state = {
        show: null,
    }

    componentDidMount() {
        this.checkConfig();
    }

    componentDidUpdate(prevProps) {
        if (this.props.keyName !== prevProps.keyName) {
            this.checkConfig();
        }
    }

    checkConfig() {
        if (this.props.dismissable && this.props.keyName) {
            apiGet('config').then(({ frontend }) => {
                this.setState({
                    show: !frontend ? true : !frontend[this.props.keyName],
                });
            });
        }
    }

    dismiss = () => {
        apiGet('config').then(config => {
            const newConf = {
                ...config,
                frontend: {
                    ...config.frontend,
                    [this.props.keyName]: true
                }
            };
            apiPost('config', newConf);
        });
        this.setState({
            show: false
        });
    }

    render({
        type = 'warning',
        dismissable,
        className,
        children,
    }, {
        show,
    }) {
        if ((dismissable && !show) || (children.length === 1 && !children[0])) {
            return null;
        }
        return (
            <div className={[style.container, style[type], className ? className : ''].join(' ')}>
                <div className={style.status}>
                    {children}
                    {
                        dismissable && (
                            <a href="#" className={style.close} onClick={this.dismiss}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </a>
                        )
                    }
                </div>
            </div>
        );
    }
}
